import type { ReactNode } from 'react';

/** All four asset categories share the same navigation and content columns. */
export function LibraryWorkspace({ navigation, children }: { navigation: ReactNode; children: ReactNode }) {
  return <div className="library-workspace">{navigation}<div className="library-main">{children}</div></div>;
}
