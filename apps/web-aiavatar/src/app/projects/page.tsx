import { redirect } from "next/navigation";

// Personal canvases now live in Creation. Canvas detail URLs remain unchanged.
export default function ProjectsPage() { redirect("/create"); }
