import type { StixObject } from './client';

// IOC object types we explicitly exclude
const EXCLUDED_TYPES = new Set([
  'indicator',
  'observed-data',
  'sighting',
  'report',
  'note',
  'opinion',
  'x-mitre-collection',
  'x-mitre-matrix',
  'x-mitre-tactic',
  'bundle',
  'identity',
  'location',
  'vulnerability',
  'infrastructure',
]);

// Only include "uses" relationships that link groups → techniques
const INCLUDED_RELATIONSHIP_TYPES = new Set(['uses', 'attributed-to']);

export interface ParsedGroup {
  stix_id: string;
  name: string;
  aliases: string[];
  description: string;
  attack_id: string | null;
  url: string | null;
}

export interface ParsedTechnique {
  stix_id: string;
  name: string;
  description: string;
  attack_id: string | null;
  url: string | null;
}

export interface ParsedRelationship {
  stix_id: string;
  relationship_type: string;
  source_ref: string;
  target_ref: string;
}

export interface ParsedBundle {
  groups: ParsedGroup[];
  techniques: ParsedTechnique[];
  relationships: ParsedRelationship[];
  skipped: number;
}

const MITRE_SOURCE_NAMES = new Set([
  'mitre-attack',
  'mitre-mobile-attack',
  'mitre-ics-attack',
  'mitre-pre-attack',
]);

function getAttackRef(obj: StixObject): { id: string | null; url: string | null } {
  if (!obj.external_references) return { id: null, url: null };
  for (const ref of obj.external_references) {
    if (MITRE_SOURCE_NAMES.has(ref.source_name ?? '') || /^mitre.*attack/i.test(ref.source_name ?? '')) {
      return { id: ref.external_id ?? null, url: ref.url ?? null };
    }
  }
  return { id: null, url: null };
}

export function parseStixBundle(objects: StixObject[]): ParsedBundle {
  const groups: ParsedGroup[] = [];
  const techniques: ParsedTechnique[] = [];
  const relationships: ParsedRelationship[] = [];
  let skipped = 0;

  for (const obj of objects) {
    if (obj.revoked) { skipped++; continue; }
    if (EXCLUDED_TYPES.has(obj.type)) { skipped++; continue; }

    if (obj.type === 'intrusion-set') {
      const { id: attack_id, url } = getAttackRef(obj);
      groups.push({
        stix_id: obj.id,
        name: obj.name ?? '',
        aliases: Array.isArray(obj.aliases) ? obj.aliases as string[] : [],
        description: (obj.description as string) ?? '',
        attack_id,
        url,
      });
    } else if (obj.type === 'attack-pattern') {
      const { id: attack_id, url } = getAttackRef(obj);
      techniques.push({
        stix_id: obj.id,
        name: obj.name ?? '',
        description: (obj.description as string) ?? '',
        attack_id,
        url,
      });
    } else if (obj.type === 'relationship') {
      const relType = obj.relationship_type ?? '';
      if (!INCLUDED_RELATIONSHIP_TYPES.has(relType)) { skipped++; continue; }
      if (!obj.source_ref || !obj.target_ref) { skipped++; continue; }
      relationships.push({
        stix_id: obj.id,
        relationship_type: relType,
        source_ref: obj.source_ref,
        target_ref: obj.target_ref,
      });
    } else {
      // malware, tool, campaign — not directly ingested as TTPs, skip
      skipped++;
    }
  }

  return { groups, techniques, relationships, skipped };
}
