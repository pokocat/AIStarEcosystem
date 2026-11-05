import { Boxes, Clapperboard, FolderOpen, Home, Image, Lightbulb, Send, Shapes, SquareDashedMousePointer, Video, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  '/dashboard': Home, '/video': Video, '/image': Image, '/create': SquareDashedMousePointer,
  '/director': Clapperboard, '/projects': FolderOpen, '/assets': Boxes, '/distribution': Send, '/templates': Lightbulb,
  // 旧版导航才有的一项
  '/scenes': Shapes,
};
export const studioNavigationIcon = (href: string): LucideIcon => icons[href] ?? Home;
