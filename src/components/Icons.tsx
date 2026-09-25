import type { ReactNode } from "react";

interface SvgProps {
  className?: string;
  children: ReactNode;
  filled?: boolean;
  viewBox?: string;
}

function Svg({ className, children, filled = false, viewBox = "0 0 24 24" }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconPlay({ className }: { className?: string }) {
  return (
    <Svg className={className} filled viewBox="0 0 24 24">
      <path d="M7 4.9v14.2c0 1 1.1 1.6 1.9 1.1l11.6-7.1c.8-.5.8-1.7 0-2.2L8.9 3.8C8.1 3.3 7 3.9 7 4.9Z" />
    </Svg>
  );
}

export function IconPlus({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconBookmark({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />
    </Svg>
  );
}

export function IconInfo({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v4h1" />
    </Svg>
  );
}

export function IconChevronDown({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function IconChevronRight({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function IconChevronLeft({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  );
}

export function IconSearch({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

export function IconGlobe({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15.3 15.3 0 0 1 0 18 15.3 15.3 0 0 1 0-18Z" />
    </Svg>
  );
}

export function IconUser({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </Svg>
  );
}

export function IconCrown({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m3 8 4.5 3.5L12 5l4.5 6.5L21 8l-1.5 10.5h-15L3 8Z" />
      <path d="M5.5 21.5h13" />
    </Svg>
  );
}

export function IconMenu({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function IconClose({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconStar({ className }: { className?: string }) {
  return (
    <Svg className={className} filled>
      <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z" />
    </Svg>
  );
}

export function IconDownload({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
    </Svg>
  );
}

export function IconCheck({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Svg>
  );
}

export function IconShare({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </Svg>
  );
}

export function IconFacebook({ className }: { className?: string }) {
  return (
    <Svg className={className} filled>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2Z" />
    </Svg>
  );
}

export function IconX({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 4l16 16M20 4 4 20" />
    </Svg>
  );
}

export function IconGithub({ className }: { className?: string }) {
  return (
    <Svg className={className} filled>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.04.77 2.1 0 1.52-.01 2.74-.01 3.11 0 .31.21.67.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </Svg>
  );
}

export function IconYoutube({ className }: { className?: string }) {
  return (
    <Svg className={className} filled>
      <path d="M23 7.5s-.22-1.56-.9-2.24c-.86-.9-1.82-.9-2.26-.95C16.7 4.15 12 4.15 12 4.15s-4.7 0-7.84.16c-.44.05-1.4.05-2.26.95C1.22 5.94 1 7.5 1 7.5S.78 9.34.78 11.17v1.66C.78 14.66 1 16.5 1 16.5s.22 1.56.9 2.24c.86.9 2 .87 2.5.97 1.81.17 7.6.22 7.6.22s4.7-.01 7.84-.17c.44-.05 1.4-.05 2.26-.95.68-.68.9-2.24.9-2.24s.22-1.84.22-3.67v-1.66C23.22 9.34 23 7.5 23 7.5ZM9.75 15.02V8.98L15.5 12l-5.75 3.02Z" />
    </Svg>
  );
}
