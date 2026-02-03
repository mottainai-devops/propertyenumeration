import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Building2, Users, AlertCircle } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Property enumeration and customer management overview
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Loading...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Buildings</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalBuildings || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Mapped properties
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pickups</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalPickups || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Customer registrations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unsynced Pickups</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.unsyncedPickups || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Pending synchronization
                </p>
              </CardContent>
            </Card>


          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href="/customers"
                className="block p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="font-semibold">Manage Customers</div>
                <div className="text-sm text-muted-foreground">
                  View and manage customer pickup records
                </div>
              </a>
              <a
                href="/properties"
                className="block p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="font-semibold">Manage Properties</div>
                <div className="text-sm text-muted-foreground">
                  View and manage building polygons
                </div>
              </a>
              <a
                href="/validation-queue"
                className="block p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="font-semibold">Validation Queue</div>
                <div className="text-sm text-muted-foreground">
                  Review and approve pending submissions
                </div>
              </a>
              <a
                href="/customer-import"
                className="block p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="font-semibold">Import Customers</div>
                <div className="text-sm text-muted-foreground">
                  Bulk upload customer data via CSV
                </div>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium">Database Server</div>
                <div className="text-sm text-muted-foreground">upwork.kowope.xyz</div>
              </div>
              <div>
                <div className="text-sm font-medium">Application Version</div>
                <div className="text-sm text-muted-foreground">v1.0.0</div>
              </div>
              <div>
                <div className="text-sm font-medium">Last Updated</div>
                <div className="text-sm text-muted-foreground">February 3, 2026</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
