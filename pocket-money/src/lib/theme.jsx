import {
  Cat, Dog, Rabbit, Bird, Fish, Turtle, Squirrel, Bug, Snail, PawPrint, Bone,
  Rocket, Star, Heart, Crown, Gamepad2, Bike, Car, Music, Trophy, Flower2,
  Sun, Moon, Zap, Ghost, Sparkles, Pizza, IceCreamCone, Candy, Cookie, Drum, Guitar, Dices, Origami,
} from "lucide-react";

export const THEME_COLORS = [
  { key: "violet", name: "Violet", main: "#5b2fa8", soft: "#e4d9f8", dark: "#3a1b6b" },
  { key: "blue", name: "Blue", main: "#1d6fe8", soft: "#dbe8fd", dark: "#143f8a" },
  { key: "teal", name: "Teal", main: "#0e7490", soft: "#d6f0f5", dark: "#0b4f61" },
  { key: "green", name: "Green", main: "#15803d", soft: "#dcf3e4", dark: "#0f5a2c" },
  { key: "orange", name: "Orange", main: "#c2410c", soft: "#fde4d6", dark: "#7c2a08" },
  { key: "pink", name: "Pink", main: "#be185d", soft: "#fbdcea", dark: "#7a0f3c" },
  { key: "red", name: "Red", main: "#b91c1c", soft: "#fde2e2", dark: "#7a1212" },
  { key: "slate", name: "Slate", main: "#334155", soft: "#e2e8f0", dark: "#1e293b" },
];

export const THEME_ICONS = {
  cat: Cat, dog: Dog, rabbit: Rabbit, bird: Bird, fish: Fish, turtle: Turtle, squirrel: Squirrel,
  bug: Bug, snail: Snail, paw: PawPrint, bone: Bone, rocket: Rocket, star: Star, heart: Heart,
  crown: Crown, gamepad: Gamepad2, bike: Bike, car: Car, music: Music, trophy: Trophy,
  flower: Flower2, sun: Sun, moon: Moon, zap: Zap, ghost: Ghost, sparkles: Sparkles, pizza: Pizza,
  icecream: IceCreamCone, candy: Candy, cookie: Cookie, drum: Drum, guitar: Guitar, dice: Dices, origami: Origami,
};
export const THEME_ICON_KEYS = Object.keys(THEME_ICONS);

export const WALLPAPERS = [
  { key: "plain", name: "Plain" },
  { key: "gradient", name: "Gradient" },
  { key: "dots", name: "Dots" },
  { key: "waves", name: "Waves" },
  { key: "stripes", name: "Stripes" },
  { key: "confetti", name: "Confetti" },
  { key: "stars", name: "Stars" },
  { key: "bubbles", name: "Bubbles" },
];

function hash(seed = "") {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// The child's chosen colour, or a stable one derived from their name.
export function themeColor(theme, seed = "") {
  const chosen = theme?.color && THEME_COLORS.find((c) => c.key === theme.color);
  return chosen || THEME_COLORS[hash(seed) % THEME_COLORS.length];
}

export function ThemeIcon({ theme, size = 16, className = "", style }) {
  const Icon = theme?.icon && THEME_ICONS[theme.icon];
  if (!Icon) return null;
  return <Icon size={size} className={className} style={style} aria-hidden />;
}

const svg = (w, h, body) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;

// Inline-SVG patterns tinted with the child's colour, so wallpapers need
// no image files and always match their palette.
export function wallpaperStyle(key, color) {
  const c = color.main;
  const base = { backgroundColor: color.soft };
  switch (key) {
    case "gradient":
      return { backgroundImage: `linear-gradient(180deg, ${color.soft} 0%, #ffffff 60%)`, backgroundColor: "#ffffff" };
    case "dots":
      return { ...base, backgroundImage: svg(24, 24, `<circle cx='12' cy='12' r='2' fill='${c}' fill-opacity='0.22'/>`) };
    case "waves":
      return { ...base, backgroundImage: svg(48, 24, `<path d='M0 12 Q12 0 24 12 T48 12' fill='none' stroke='${c}' stroke-opacity='0.22' stroke-width='2'/>`) };
    case "stripes":
      return { ...base, backgroundImage: `repeating-linear-gradient(135deg, ${c}22 0 10px, transparent 10px 24px)` };
    case "confetti":
      return {
        ...base,
        backgroundImage: svg(80, 80, [
          `<rect x='8' y='10' width='8' height='4' rx='1' transform='rotate(20 12 12)' fill='${c}' fill-opacity='0.3'/>`,
          `<rect x='50' y='22' width='8' height='4' rx='1' transform='rotate(-35 54 24)' fill='${c}' fill-opacity='0.3'/>`,
          `<rect x='28' y='54' width='8' height='4' rx='1' transform='rotate(60 32 56)' fill='${c}' fill-opacity='0.3'/>`,
          `<circle cx='66' cy='60' r='3' fill='${c}' fill-opacity='0.25'/>`,
          `<circle cx='20' cy='36' r='2' fill='${c}' fill-opacity='0.25'/>`,
        ].join("")),
      };
    case "stars":
      return {
        ...base,
        backgroundImage: svg(64, 64, [
          `<path d='M16 6l2.4 5 5.6.8-4 3.9.9 5.5L16 18.6l-4.9 2.6.9-5.5-4-3.9 5.6-.8z' fill='${c}' fill-opacity='0.22'/>`,
          `<path d='M46 36l1.6 3.3 3.7.5-2.7 2.6.6 3.7-3.2-1.7-3.3 1.7.6-3.7-2.6-2.6 3.7-.5z' fill='${c}' fill-opacity='0.18'/>`,
        ].join("")),
      };
    case "bubbles":
      return {
        ...base,
        backgroundImage: svg(96, 96, [
          `<circle cx='20' cy='24' r='10' fill='${c}' fill-opacity='0.12'/>`,
          `<circle cx='66' cy='18' r='5' fill='${c}' fill-opacity='0.16'/>`,
          `<circle cx='76' cy='66' r='14' fill='${c}' fill-opacity='0.1'/>`,
          `<circle cx='30' cy='74' r='6' fill='${c}' fill-opacity='0.16'/>`,
        ].join("")),
      };
    case "plain":
    default:
      return { backgroundColor: "#f5f6fa" };
  }
}
