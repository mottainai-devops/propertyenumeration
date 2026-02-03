import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Search, Eye, MapPin, Building2, Users, Loader2, ExternalLink } from "lucide-react";
import { useState, useMemo } from "react";
import type { Building } from "@shared/types";

export default function Properties() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  // Fetch data
  const { data: buildings = [], isLoading } = trpc.buildings.list.useQuery();

  // Filter and search logic
  const filteredBuildings = useMemo(() => {
    return buildings.filter((building) => {
      const matchesSearch =
        searchTerm === "" ||
        building.buildingId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        building.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        building.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        building.zone?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [buildings, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => {
    const withCustomers = buildings.filter(
      (b) => b.customerLabels && b.customerLabels.length > 0
    ).length;
    const withoutCustomers = buildings.length - withCustomers;
    const totalCustomers = buildings.reduce((sum, b) => {
      if (!b.customerLabels) return sum;
      return sum + b.customerLabels.split(",").filter((l) => l.trim()).length;
    }, 0);

    return {
      total: buildings.length,
      withCustomers,
      withoutCustomers,
      totalCustomers,
    };
  }, [buildings]);

  const parseGeometry = (geometryStr: string) => {
    try {
      const geometry = JSON.parse(geometryStr);
      if (geometry.type === "Polygon" && geometry.coordinates?.[0]) {
        return geometry.coordinates[0];
      }
      return null;
    } catch {
      return null;
    }
  };

  const openInGoogleMaps = (lat: number, lon: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lon}`, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Buildings / Properties</h1>
          <p className="text-muted-foreground">
            View and manage building polygons from ArcGIS Feature Service
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Buildings</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.withCustomers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0
                  ? `${((stats.withCustomers / stats.total) * 100).toFixed(1)}% occupied`
                  : "0% occupied"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empty Buildings</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.withoutCustomers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0
                  ? `${((stats.withoutCustomers / stats.total) * 100).toFixed(1)}% vacant`
                  : "0% vacant"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Buildings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="search">Search by Building ID, Business Name, Address, or Zone</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Enter search term..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Buildings Table */}
        <Card>
          <CardHeader>
            <CardTitle>Building Records ({filteredBuildings.length})</CardTitle>
            <CardDescription>
              Polygon data synced from ArcGIS Feature Service
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredBuildings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No building records found
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Building ID</TableHead>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Customers</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBuildings.map((building) => {
                      const customerCount = building.customerLabels
                        ? building.customerLabels.split(",").filter((l) => l.trim()).length
                        : 0;

                      return (
                        <TableRow key={building.id}>
                          <TableCell className="font-mono text-xs">
                            {building.buildingId}
                          </TableCell>
                          <TableCell>
                            {building.businessName || (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {building.zone || (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {building.address || (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {customerCount > 0 ? (
                              <Badge variant="default" className="bg-green-500">
                                {customerCount} customer{customerCount > 1 ? "s" : ""}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Empty</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                openInGoogleMaps(parseFloat(building.centerLat), parseFloat(building.centerLon))
                              }
                            >
                              <MapPin className="h-4 w-4 mr-1" />
                              Map
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedBuilding(building)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Details Dialog */}
      <Dialog open={!!selectedBuilding} onOpenChange={() => setSelectedBuilding(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Building Details</DialogTitle>
            <DialogDescription>
              Building ID: {selectedBuilding?.buildingId}
            </DialogDescription>
          </DialogHeader>
          {selectedBuilding && (
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Building ID:</span>
                    <p className="font-medium font-mono">{selectedBuilding.buildingId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Business Name:</span>
                    <p className="font-medium">
                      {selectedBuilding.businessName || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Zone:</span>
                    <p className="font-medium">{selectedBuilding.zone || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Socio-Economic Group:</span>
                    <p className="font-medium">
                      {selectedBuilding.socioEconomicGroups || "N/A"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Address:</span>
                    <p className="font-medium">{selectedBuilding.address || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              {(selectedBuilding.custPhone || selectedBuilding.customerEmail) && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {selectedBuilding.custPhone && (
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <p className="font-medium">{selectedBuilding.custPhone}</p>
                      </div>
                    )}
                    {selectedBuilding.customerEmail && (
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <p className="font-medium">{selectedBuilding.customerEmail}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Center Coordinates:</span>
                    <p className="font-medium font-mono">
                      {parseFloat(selectedBuilding.centerLat).toFixed(6)},{" "}
                      {parseFloat(selectedBuilding.centerLon).toFixed(6)}
                    </p>
                  </div>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openInGoogleMaps(
                          parseFloat(selectedBuilding.centerLat),
                          parseFloat(selectedBuilding.centerLon)
                        )
                      }
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in Google Maps
                    </Button>
                  </div>
                </div>
              </div>

              {/* Polygon Geometry */}
              <div className="space-y-2">
                <h3 className="font-semibold">Polygon Geometry</h3>
                <div className="text-sm">
                  {(() => {
                    const coords = parseGeometry(selectedBuilding.geometry);
                    if (!coords) {
                      return (
                        <p className="text-muted-foreground">
                          Invalid geometry format
                        </p>
                      );
                    }
                    return (
                      <div className="bg-muted p-3 rounded-md max-h-40 overflow-y-auto">
                        <p className="font-mono text-xs">
                          {coords.length} vertices
                        </p>
                        <div className="mt-2 space-y-1">
                          {coords.slice(0, 5).map((coord: number[], idx: number) => (
                            <p key={idx} className="font-mono text-xs">
                              [{coord[0].toFixed(6)}, {coord[1].toFixed(6)}]
                            </p>
                          ))}
                          {coords.length > 5 && (
                            <p className="text-xs text-muted-foreground">
                              ... and {coords.length - 5} more vertices
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Customer Labels */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Registered Customers
                </h3>
                {selectedBuilding.customerLabels &&
                selectedBuilding.customerLabels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedBuilding.customerLabels
                      .split(",")
                      .filter((label) => label.trim())
                      .map((label, idx) => (
                        <Badge key={idx} variant="secondary">
                          {label.trim()}
                        </Badge>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No customers registered for this building
                  </p>
                )}
              </div>

              {/* Timestamps */}
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Last Updated: {new Date(selectedBuilding.lastUpdated).toLocaleString()}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBuilding(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
