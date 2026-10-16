import {
  Bed, Utensils, Brush, Shirt, Trash2, Dog, Cat, Fish, Sprout, Flower2, BookOpen, Backpack, Car,
  ShoppingCart, Footprints, Bath, Droplets, Recycle, Leaf, Paintbrush, Pencil, Hammer, Dumbbell,
  Bike, Music, Gamepad2, Cookie, Apple, Baby, Sun, Moon, Star, Heart, Sparkles, WashingMachine,
  Lamp, Sofa, Laptop, Trophy, Soup, CookingPot, Package, Mail, Smile,
} from "lucide-react";

// Chore icons are stored by key. Anything not in this map (older chores
// saved with an emoji) is shown as the text itself.
export const CHORE_ICONS = {
  bed: Bed, utensils: Utensils, brush: Brush, shirt: Shirt, bin: Trash2, dog: Dog, cat: Cat, fish: Fish,
  sprout: Sprout, flower: Flower2, book: BookOpen, backpack: Backpack, car: Car, cart: ShoppingCart,
  shoes: Footprints, bath: Bath, droplets: Droplets, recycle: Recycle, leaf: Leaf, paintbrush: Paintbrush,
  pencil: Pencil, hammer: Hammer, dumbbell: Dumbbell, bike: Bike, music: Music, gamepad: Gamepad2,
  cookie: Cookie, apple: Apple, baby: Baby, sun: Sun, moon: Moon, star: Star, heart: Heart,
  sparkles: Sparkles, laundry: WashingMachine, lamp: Lamp, sofa: Sofa, laptop: Laptop, trophy: Trophy,
  soup: Soup, pot: CookingPot, package: Package, mail: Mail, smile: Smile,
};
export const CHORE_ICON_KEYS = Object.keys(CHORE_ICONS);

export function ChoreIcon({ icon, size = 18, className = "" }) {
  const Icon = icon && CHORE_ICONS[icon];
  if (Icon) return <Icon size={size} className={className} strokeWidth={2.1} aria-hidden />;
  return <span aria-hidden>{icon || "•"}</span>;
}

export const CHORE_IDEAS = [
  { icon: "bed", name: "Make bed" },
  { icon: "utensils", name: "Clear the table" },
  { icon: "droplets", name: "Wash up" },
  { icon: "sparkles", name: "Tidy bedroom" },
  { icon: "laundry", name: "Put laundry away" },
  { icon: "bin", name: "Take bins out" },
  { icon: "dog", name: "Feed the pet" },
  { icon: "sprout", name: "Water the plants" },
  { icon: "book", name: "Homework done" },
  { icon: "brush", name: "Brush teeth" },
  { icon: "package", name: "Put toys away" },
  { icon: "cart", name: "Help with shopping" },
  { icon: "soup", name: "Help cook dinner" },
  { icon: "leaf", name: "Help in the garden" },
  { icon: "car", name: "Wash the car" },
  { icon: "shoes", name: "Line up shoes" },
];
