import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const TEAL = "#6BBBB4";
const LOGO_ICON = "/logos/verbivore-icon.svg";

const SIZES = {
  sm: "h-8 w-8",
  md: "h-14 w-14",
  lg: "h-20 w-20",
};

function LogoIcon({ size = "lg", className = "" }) {
  return (
    <img
      src={LOGO_ICON}
      alt=""
      aria-hidden="true"
      className={`${SIZES[size]} ${className}`}
    />
  );
}

function Dots({ light = false }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: light ? "#E8FFFF" : TEAL }}
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function PulseVariant({ label, size }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <motion.div
        className="relative rounded-3xl"
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.span
          className="absolute inset-0 rounded-3xl"
          style={{ border: `1px solid ${TEAL}` }}
          animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
        <LogoIcon size={size} className="relative" />
      </motion.div>
      {label && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{label}</span>
          <Dots />
        </div>
      )}
    </div>
  );
}

function WaveVariant({ label, size }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className={`relative overflow-hidden rounded-2xl ${SIZES[size]}`}>
        <LogoIcon size={size} className="absolute inset-0" />
        <motion.div
          className="absolute inset-y-0 w-1/2 -left-1/2 bg-white/45 blur-md"
          animate={{ x: [0, 200] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      {label && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{label}</span>
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-4 h-4" style={{ color: TEAL }} />
          </motion.span>
        </div>
      )}
    </div>
  );
}

function SplashVariant({ label }) {
  return (
    <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-2xl bg-[#052629] px-8 py-10 text-white shadow-sm">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(107,187,180,0.28),transparent_45%)]" />
      <motion.div
        className="relative flex items-center gap-4 px-5 py-4 border rounded-2xl border-white/10 bg-white/5 backdrop-blur"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <LogoIcon size="md" />
        {label && <span className="text-sm text-white/80">{label}</span>}
      </motion.div>
      <div className="relative w-48 h-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full bg-white rounded-full"
          style={{ width: "45%" }}
          animate={{ x: ["-100%", "230%"] }}
          transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

function SkeletonVariant({ label, rows = 3 }) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-5">
        <motion.div
          animate={{ rotate: [0, -3, 3, 0] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          <LogoIcon size="sm" />
        </motion.div>
        {label && (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <Dots />
          </div>
        )}
      </div>
      <div className="grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 border rounded-xl border-border bg-card">
            <div className="w-3/4 h-3 rounded-full animate-pulse bg-secondary" />
            <div className="w-2/3 h-2 mt-3 rounded-full animate-pulse bg-secondary" />
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: TEAL, width: "40%" }}
                animate={{ x: ["-120%", "280%"] }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InlineVariant({ label, size = "sm" }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <LogoIcon size={size} />
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 className="w-4 h-4" style={{ color: TEAL }} />
      </motion.span>
      {label && <span>{label}</span>}
    </div>
  );
}

function BarVariant({ label, size }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <LogoIcon size={size} />
      <div className="relative w-48 h-1 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="absolute inset-y-0 left-0 w-1/3 rounded-full"
          style={{ backgroundColor: TEAL }}
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}

const VARIANTS = {
  pulse: PulseVariant,
  wave: WaveVariant,
  splash: SplashVariant,
  skeleton: SkeletonVariant,
  inline: InlineVariant,
  bar: BarVariant,
};

/**
 * Branded loading state.
 *
 * Props:
 *  - variant:  'pulse' (default) | 'wave' | 'splash' | 'skeleton' | 'inline' | 'bar'
 *  - label:    short status text (optional)
 *  - size:     'sm' | 'md' | 'lg' (controls logo size for non-skeleton variants)
 *  - rows:     rows count for skeleton variant
 *  - fullscreen: wraps in a centered min-h-[60vh] container (default false)
 *  - delay:    ms to wait before rendering (default 400). Prevents a flash
 *              for sub-second loads. Pass 0 to render immediately.
 *  - className: extra classes on the wrapper
 */
export default function Loader({
  variant = "pulse",
  label = "",
  size = "lg",
  rows = 3,
  fullscreen = false,
  delay = 250,
  className = "",
}) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!visible) return null;

  const Variant = VARIANTS[variant] || PulseVariant;
  const content = <Variant label={label} size={size} rows={rows} />;

  if (!fullscreen) {
    return (
      <div
        className={`animate-in fade-in duration-300 ${className}`}
        role="status"
        aria-live="polite"
      >
        {content}
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[60vh] flex-col items-center justify-center px-4 py-8 animate-in fade-in duration-300 ${className}`}
      role="status"
      aria-live="polite"
    >
      {content}
      <span className="sr-only">Loading</span>
    </div>
  );
}
