import { Boxes, Clapperboard, FolderOpen, Home, Image, LayoutTemplate, Send, Shapes, SquareDashedMousePointer, Video, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  '/dashboard': Home, '/video': Video, '/image': Image, '/create': SquareDashedMousePointer,
  '/director': Clapperboard, '/projects': FolderOpen, '/assets': Boxes, '/distribution': Send,
  // 旧版导航才有的两项
  '/scenes': Shapes, '/templates': LayoutTemplate,
};
export const studioNavigationIcon = (href: string): LucideIcon => icons[href] ?? Home;
