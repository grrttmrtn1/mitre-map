import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 mb-3">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={11} className="text-gray-300 dark:text-slate-700" />}
          {item.href ? (
            <Link to={item.href} className="hover:text-gray-700 dark:hover:text-slate-300 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-600 dark:text-slate-400 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
