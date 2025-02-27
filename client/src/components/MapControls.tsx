import { Button } from "./ui/button";
import { useGameStore } from "@/lib/store";
import { AdminPanel } from "./AdminPanel";
import { useState } from "react";
import { Dialog, DialogContent } from "./ui/dialog";

export function MapControls() {
  const { setSelectedCity } = useGameStore();
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
      <Button
        variant="secondary"
        size="icon"
        onClick={() => setSelectedCity(null)}
      >
        <span className="sr-only">Закрыть панель города</span>
        X
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsAdminPanelOpen(true)}
      >
        <span className="sr-only">Открыть админ-панель</span>
        A
      </Button>

      <Dialog open={isAdminPanelOpen} onOpenChange={setIsAdminPanelOpen}>
        <DialogContent>
          <AdminPanel />
        </DialogContent>
      </Dialog>
    </div>
  );
}