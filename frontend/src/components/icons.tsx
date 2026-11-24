interface IconProps {
  size?: number;
}

function base(size = 16) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

export function IconDashboard({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
    </svg>
  );
}

export function IconHome({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

export function IconBuilding({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="4" y="3" width="10" height="18" rx="1" />
      <path d="M14 9h6v12h-6" />
      <path d="M7 7h4M7 11h4M7 15h4M17 13h1M17 17h1" />
    </svg>
  );
}

export function IconUsers({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.2 2.5-5.2 5.5-5.2s5.5 2 5.5 5.2" />
      <path d="M16 5.4a3 3 0 0 1 0 5.6M17.5 14.6c2 .6 3.2 2.4 3.2 4.6" />
    </svg>
  );
}

export function IconContact({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10.5" r="2.2" />
      <path d="M5.5 16.5c0-1.9 1.6-3 3.5-3s3.5 1.1 3.5 3" />
      <path d="M15 9.5h3M15 13h3" />
    </svg>
  );
}

export function IconPipeline({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="4" width="5" height="10" rx="1" />
      <rect x="17" y="4" width="4" height="13" rx="1" />
    </svg>
  );
}

export function IconTask({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <path d="M8 3v3M16 3v3M4 10h16" />
      <path d="m8.5 15 2 2 4-4" />
    </svg>
  );
}

export function IconCalendar({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
      <circle cx="8.5" cy="14.5" r="1" />
      <circle cx="12" cy="14.5" r="1" />
      <circle cx="15.5" cy="14.5" r="1" />
    </svg>
  );
}

export function IconChart({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16v-5M13 16V7M18 16v-8" />
    </svg>
  );
}

export function IconData({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3v11" />
      <path d="m7.5 10 4.5 4 4.5-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function IconStaff({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.5 3.1-5.6 7-5.6s7 2.1 7 5.6" />
    </svg>
  );
}

export function IconSearch({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  );
}

export function IconBell({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M18 15.5V10a6 6 0 1 0-12 0v5.5L4.5 18h15z" />
      <path d="M10 21h4" />
    </svg>
  );
}

export function IconChevron({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconPlus({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconEye({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function IconEyeOff({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 4l16 16" />
      <path d="M9.9 5.2A9.9 9.9 0 0 1 12 5c5.9 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4.1" />
      <path d="M6.3 6.9A17 17 0 0 0 2.5 12s3.6 7 9.5 7a9.6 9.6 0 0 0 3.9-.8" />
      <path d="M9.8 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
