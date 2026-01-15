import React, { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getUserPreferences, updateUserPreferences } from '../services/googleSheets';
import { toast } from 'sonner';
import { Loader2, Bell } from 'lucide-react';
import { format } from 'date-fns';

const SettingsDialog = ({ open, onOpenChange, email }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [enabled, setEnabled] = useState(false);
  const [timeSlot, setTimeSlot] = useState("8"); // "8" or "9"
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    if (open && email) {
        loadSettings();
    }
  }, [open, email]);

  const loadSettings = async () => {
    setLoading(true);
    try {
        const prefs = await getUserPreferences(email);
        if (prefs) {
            setEnabled(prefs.enabled);
            setTimeSlot(prefs.timeSlot || "8");
            setLastSaved(prefs.lastUpdated);
        } else {
            // Defaults
            setEnabled(true);
            setTimeSlot("8");
            setLastSaved(null); // Clear previous cache
        }
    } catch (e) {
        console.error("Failed to load settings", e);
        toast.error("Failed to load settings. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    console.log("Saving preferences:", { email, enabled, timeSlot }); // DEBUG LOG
    try {
        await updateUserPreferences(email, enabled, timeSlot);
        toast.success("Settings saved successfully");
        onOpenChange(false);
    } catch (e) {
        console.error("Failed to save settings", e);
        toast.error("Failed to save settings");
    } finally {
        setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" /> Settings
          </DialogTitle>
          <DialogDescription>
            Manage your daily attendance reminders.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
            <div className="py-8 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        ) : (
            <div className="grid gap-6 py-4">
                <div className="flex items-center justify-between space-x-2">
                    <div className="flex flex-col space-y-1">
                        <Label htmlFor="reminder-mode" className="font-medium text-base">Daily Check-in Reminder</Label>
                        <span className="text-sm text-muted-foreground">Receive a Teams notification to check in.</span>
                    </div>
                    <Switch 
                        id="reminder-mode" 
                        checked={enabled}
                        onCheckedChange={(val) => {
                            console.log("Switch toggled to:", val); // DEBUG LOG
                            setEnabled(val);
                        }}
                    />
                </div>

                <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="time-slot" className="font-medium">Reminder Time (Mon-Fri)</Label>
                    <Select 
                        value={timeSlot} 
                        onValueChange={(val) => {
                            setTimeSlot(val);
                            if (!enabled) setEnabled(true); // Auto-enable if off
                        }}
                    >
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="8">8:00 AM</SelectItem>
                            <SelectItem value="9">9:00 AM</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        )}
        
        {/* Last Saved Footer Info */}
        {!loading && (lastSaved || enabled) && (
            <div className="px-1 pb-2">
                <p className="text-[10px] text-muted-foreground text-center">
                    {lastSaved 
                        ? `Last saved: ${format(new Date(lastSaved), "MMM d, yyyy 'at' h:mm a")}` 
                        : "Settings not saved yet"}
                </p>
            </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
