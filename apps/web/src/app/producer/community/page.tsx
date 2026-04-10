"use client";

import { useRouter } from "next/navigation";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDictionary } from "@/features/shared/hooks/use-dictionary";

export default function ProducerCommunityRoute() {
  const router = useRouter();
  const { copy } = useDictionary();

  return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-center max-w-lg mx-auto relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.08),transparent_60%)] pointer-events-none" />
      <div className="relative z-10 w-28 h-28 bg-[#0c0c0e] rounded-3xl flex items-center justify-center border-2 border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
        <Smile className="w-12 h-12 text-red-500" />
      </div>
      <h3 className="relative z-10 text-4xl font-black text-white mt-8 mb-4 tracking-tight">
        {copy.producer.locked.title}
      </h3>
      <p className="relative z-10 text-gray-400 mb-10 leading-relaxed max-w-sm text-sm">
        {copy.producer.locked.desc}
      </p>
      <div className="relative z-10 grid grid-cols-2 gap-4 w-full">
        <Button
          variant="outline"
          onClick={() => router.push("/producer/overview")}
          className="h-14 border-white/10 hover:bg-white/5 font-bold tracking-wider rounded-xl"
        >
          {copy.producer.locked.back}
        </Button>
        <Button className="h-14 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black tracking-widest border border-red-500/50 rounded-xl">
          UPGRADE
        </Button>
      </div>
    </div>
  );
}
