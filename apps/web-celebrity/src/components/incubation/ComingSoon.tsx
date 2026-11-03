"use client";

// AI 艺人孵化是路演演示版：能力入口都能点，点了说明这项能力是做什么的、正在完善中。

import * as React from "react";
import { Hammer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";
import { Button } from "@/components/creator";

interface ComingSoonInfo {
  title: string;
  desc?: string;
}

const ComingSoonContext = React.createContext<(info: ComingSoonInfo) => void>(() => {});

export function useComingSoon() {
  return React.useContext(ComingSoonContext);
}

export function ComingSoonProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = React.useState<ComingSoonInfo | null>(null);
  return (
    <ComingSoonContext.Provider value={setInfo}>
      {children}
      <Dialog open={info !== null} onOpenChange={(open) => !open && setInfo(null)}>
        <DialogContent style={{ maxWidth: 420 }}>
          <DialogHeader>
            <div
              aria-hidden
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-md)",
                background: "var(--accent-soft)",
                color: "var(--accent-strong)",
                display: "grid",
                placeItems: "center",
                marginBottom: 6,
              }}
            >
              <Hammer size={18} />
            </div>
            <DialogTitle>{info?.title}正在完善中</DialogTitle>
            <DialogDescription>
              {info?.desc ? `${info.desc} ` : ""}这一版是演示，功能上线后在这里直接使用。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="dark" size="sm" onClick={() => setInfo(null)}>
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ComingSoonContext.Provider>
  );
}
