import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Download, Smartphone, CheckCircle2, AlertTriangle, ShieldCheck, Info } from "lucide-react";
import { useState, useEffect } from "react";

export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  const [progress, setProgress] = useState(0);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem('mottainai_testing_progress');
    if (saved) {
      const states = JSON.parse(saved);
      setCheckedItems(states);
    }
  }, []);

  useEffect(() => {
    const total = 14; // Total checklist items
    const checked = Object.values(checkedItems).filter(Boolean).length;
    const percentage = Math.round((checked / total) * 100);
    setProgress(percentage);
    localStorage.setItem('mottainai_testing_progress', JSON.stringify(checkedItems));
  }, [checkedItems]);

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="min-h-screen bg-background font-mono selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <header className="border-b-4 border-border bg-background sticky top-0 z-50">
        <div className="container py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">
              Mottainai<span className="text-primary">.APK</span>
            </h1>
            <p className="text-muted-foreground font-bold mt-1">
              SURVEY APP DISTRIBUTION CENTER
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-sm font-bold">v1.0.0</div>
              <div className="text-xs text-muted-foreground">Feb 3, 2026</div>
            </div>
            {isAuthenticated ? (
              <Button 
                size="lg" 
                className="rounded-none border-2 border-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all hover:bg-primary hover:text-primary-foreground font-bold"
                onClick={() => window.location.href = '/dashboard'}
              >
                GO TO DASHBOARD
              </Button>
            ) : (
              <Button 
                size="lg" 
                className="rounded-none border-2 border-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all hover:bg-primary hover:text-primary-foreground font-bold"
                onClick={() => window.location.href = '/mottainai-admin-app-v1.0-release.apk'}
              >
                <Download className="mr-2 h-5 w-5" />
                DOWNLOAD APK
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container py-12 space-y-16">
        {/* Hero Stats */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "COMPATIBILITY", value: "100%", sub: "All Android Devices" },
            { label: "ARCHITECTURES", value: "4", sub: "ARMv7, ARM64, x86" },
            { label: "FILE SIZE", value: "24.2 MB", sub: "Fat APK Build" },
            { label: "STATUS", value: "STABLE", sub: "Production Ready" },
          ].map((stat, i) => (
            <Card key={i} className="rounded-none border-2 border-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <CardContent className="p-6">
                <div className="text-sm font-bold text-muted-foreground mb-2">{stat.label}</div>
                <div className="text-4xl font-black tracking-tighter">{stat.value}</div>
                <div className="text-xs font-bold mt-2 bg-secondary inline-block px-2 py-1">
                  {stat.sub}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Critical Updates */}
        <section>
          <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-accent" />
            Critical Updates
          </h2>
          <div className="grid gap-4">
            <div className="border-2 border-border p-4 bg-accent/10 flex gap-4 items-start">
              <div className="bg-accent text-accent-foreground p-2 font-bold">FIX</div>
              <div>
                <h3 className="font-bold text-lg">Universal Device Support</h3>
                <p className="text-muted-foreground">Added native libraries for older (armeabi-v7a) and budget devices. Now supports Tecno, Infinix, and Samsung J-series phones.</p>
              </div>
            </div>
            <div className="border-2 border-border p-4 bg-accent/10 flex gap-4 items-start">
              <div className="bg-accent text-accent-foreground p-2 font-bold">FIX</div>
              <div>
                <h3 className="font-bold text-lg">Sync Status Resolution</h3>
                <p className="text-muted-foreground">Resolved issue where completed pickups remained in "Pending" state after successful synchronization.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Distribution Methods */}
        <section>
          <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-3">
            <Smartphone className="h-8 w-8" />
            Distribution Channels
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="rounded-none border-2 border-border hover:border-primary transition-colors">
              <CardHeader>
                <CardTitle className="font-black uppercase">1. Direct Download</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">Share APK file directly via WhatsApp or Bluetooth.</p>
                <div className="text-xs font-bold space-y-2">
                  <div className="text-accent flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> FASTEST
                  </div>
                  <div className="text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> MANUAL UPDATES
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="rounded-none border-2 border-border bg-secondary/50">
              <CardHeader>
                <CardTitle className="font-black uppercase">2. Play Store</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">Official distribution via Google Play Console.</p>
                <div className="text-xs font-bold space-y-2">
                  <div className="text-accent flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> AUTO UPDATES
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4" /> REQUIRES REVIEW
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-none border-2 border-border bg-secondary/50">
              <CardHeader>
                <CardTitle className="font-black uppercase">3. Internal Test</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">Google Play Internal Testing Track.</p>
                <div className="text-xs font-bold space-y-2">
                  <div className="text-accent flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> SECURE
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4" /> EMAIL INVITE
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Testing Checklist */}
        <section className="border-4 border-border p-6 md:p-8 bg-card relative">
          <div className="absolute -top-5 left-6 bg-background px-4 border-2 border-border font-black text-xl uppercase">
            Field Verification Protocol
          </div>
          
          <div className="mb-8">
            <div className="flex justify-between text-sm font-bold mb-2">
              <span>PROGRESS</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-4 rounded-none border-2 border-border bg-secondary [&>div]:bg-primary" />
          </div>

          <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
            <div>
              <h3 className="font-bold text-lg mb-4 border-b-2 border-border pb-2">DEVICE COMPATIBILITY</h3>
              <div className="space-y-3">
                {[
                  { id: "test1", label: "Modern Device (ARM64)" },
                  { id: "test2", label: "Budget Device (ARMv7/32-bit)" },
                  { id: "test3", label: "Emulator (x86_64)" },
                  { id: "test4", label: "Android 14 / 13 / 11 / 8" },
                ].map(item => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <Checkbox 
                      id={item.id} 
                      checked={checkedItems[item.id]}
                      onCheckedChange={() => toggleCheck(item.id)}
                      className="rounded-none border-2 border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-6 w-6"
                    />
                    <label htmlFor={item.id} className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer ${checkedItems[item.id] ? 'line-through opacity-50' : ''}`}>
                      {item.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4 border-b-2 border-border pb-2">CORE FUNCTIONALITY</h3>
              <div className="space-y-3">
                {[
                  { id: "test5", label: "Clean Install" },
                  { id: "test6", label: "User Login" },
                  { id: "test7", label: "Pickup Submission" },
                  { id: "test8", label: "Camera / Photo Upload" },
                  { id: "test9", label: "GPS Location Lock" },
                  { id: "test10", label: "Offline Mode Save" },
                  { id: "test11", label: "Auto-Sync on Reconnect" },
                ].map(item => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <Checkbox 
                      id={item.id} 
                      checked={checkedItems[item.id]}
                      onCheckedChange={() => toggleCheck(item.id)}
                      className="rounded-none border-2 border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-6 w-6"
                    />
                    <label htmlFor={item.id} className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer ${checkedItems[item.id] ? 'line-through opacity-50' : ''}`}>
                      {item.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t-2 border-border pt-8 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-4">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-bold">SECURE DISTRIBUTION CHANNEL</span>
          </div>
          <p>© 2026 Mottainai DevOps Team. Authorized Personnel Only.</p>
        </footer>
      </main>
    </div>
  );
}
