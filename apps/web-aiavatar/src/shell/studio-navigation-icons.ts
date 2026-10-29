import { Boxes, Clapperboard, FolderOpen, Home, Image, Send, SquareDashedMousePointer, Video, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  '/dashboard': Home, '/video': Video, '/image': Image, '/create': SquareDashedMousePointer,
  '/director': Clapperboard, '/projects': FolderOpen, '/assets': Boxes, '/distribution': Send,
};
export const studioNavigationIcon = (href: string): LucideIcon => icons[href] ?? Home;
