export const GITHUB_RELEASES_API = 'https://api.github.com/repos/mitre-attack/attack-stix-data/releases/latest';
export const GH_HEADERS = { 'User-Agent': 'mitremap/1.0', 'Accept': 'application/vnd.github+json' };

export interface StixTactic {
  id: string; name: string; shortname: string; description: string;
}

export interface StixTechnique {
  stix_id: string; id: string; name: string; description: string;
  phase_names: string[]; is_subtechnique: number; parent_id: string | null; url: string | null;
}

export interface StixMitigation {
  id: string; name: string; description: string; url: string | null;
}

export interface ParsedStix {
  version: string;
  tactics: StixTactic[];
  techniques: StixTechnique[];
  mitigations: StixMitigation[];
  mitRelationships: Array<{ mitigation_id: string; stix_tech_id: string }>;
  revokedByMap: Map<string, string>;
  deprecatedStixIds: Set<string>;
  stixIdToTechId: Map<string, string>;
}

export async function fetchAndParseStix(targetVersion?: string): Promise<ParsedStix | null> {
  try {
    let version = targetVersion;
    let tag: string;
    if (!version) {
      const ghRes = await fetch(GITHUB_RELEASES_API, { headers: GH_HEADERS });
      if (!ghRes.ok) return null;
      const release = await ghRes.json() as any;
      tag = release.tag_name as string;
      version = tag.replace(/^(?:ATT&CK-v|v)/, '');
    } else {
      version = version.replace(/^v/, '');
      tag = `v${version}`;
    }

    const stixUrl = `https://raw.githubusercontent.com/mitre-attack/attack-stix-data/${encodeURIComponent(tag)}/enterprise-attack/enterprise-attack-${version}.json`;
    const stixRes = await fetch(stixUrl, { headers: { 'User-Agent': 'mitremap/1.0' } });
    if (!stixRes.ok) return null;

    const bundle = await stixRes.json() as any;

    const tactics: StixTactic[] = [];
    const techniques: StixTechnique[] = [];
    const mitigations: StixMitigation[] = [];
    const stixIdToTechId = new Map<string, string>();
    const stixIdToMitId = new Map<string, string>();
    const mitRelationships: Array<{ mitigation_id: string; stix_tech_id: string }> = [];
    const deprecatedStixIds = new Set<string>();
    const revokedByMap = new Map<string, string>();

    for (const obj of bundle.objects ?? []) {
      if (obj.type === 'x-mitre-tactic') {
        const ref = obj.external_references?.find((r: any) => r.source_name === 'mitre-attack');
        if (ref?.external_id) {
          tactics.push({ id: ref.external_id, name: obj.name, shortname: obj.x_mitre_shortname ?? '', description: obj.description ?? '' });
        }
      } else if (obj.type === 'attack-pattern') {
        const ref = obj.external_references?.find((r: any) => r.source_name === 'mitre-attack');
        if (!ref?.external_id) continue;
        stixIdToTechId.set(obj.id, ref.external_id);
        if (obj.x_mitre_deprecated || obj.revoked) { deprecatedStixIds.add(obj.id); continue; }
        const phaseNames: string[] = (obj.kill_chain_phases ?? [])
          .filter((p: any) => p.kill_chain_name === 'mitre-attack')
          .map((p: any) => p.phase_name);
        techniques.push({
          stix_id: obj.id,
          id: ref.external_id,
          name: obj.name,
          description: obj.description ?? '',
          phase_names: phaseNames,
          is_subtechnique: obj.x_mitre_is_subtechnique ? 1 : 0,
          parent_id: obj.x_mitre_is_subtechnique ? ref.external_id.split('.')[0] : null,
          url: ref.url ?? null,
        });
      } else if (obj.type === 'course-of-action') {
        const ref = obj.external_references?.find((r: any) => r.source_name === 'mitre-attack');
        if (!ref?.external_id?.startsWith('M')) continue;
        stixIdToMitId.set(obj.id, ref.external_id);
        if (obj.x_mitre_deprecated || obj.revoked) continue;
        mitigations.push({ id: ref.external_id, name: obj.name, description: obj.description ?? '', url: ref.url ?? null });
      } else if (obj.type === 'relationship') {
        if (obj.relationship_type === 'mitigates') {
          const mitId = stixIdToMitId.get(obj.source_ref);
          if (mitId) mitRelationships.push({ mitigation_id: mitId, stix_tech_id: obj.target_ref });
        } else if (obj.relationship_type === 'revoked-by') {
          revokedByMap.set(obj.source_ref, obj.target_ref);
        }
      }
    }

    return { version, tactics, techniques, mitigations, mitRelationships, revokedByMap, deprecatedStixIds, stixIdToTechId };
  } catch {
    return null;
  }
}
