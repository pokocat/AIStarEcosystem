import { Boxes, Clapperboard, FolderOpen, Home, Image, Lightbulb, Send, SquareDashedMousePointer, Video, Wrench, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  '/dashboard': Home, '/video': Video, '/image': Image, '/create': SquareDashedMousePointer,
  '/director': Clapperboard, '/projects': FolderOpen, '/assets': Boxes, '/distribution': Send, '/templates': Lightbulb,
  '/toolbox': Wrench,
};
export const studioNavigationIcon = (href: string): LucideIcon => icons[href] ?? Home;
