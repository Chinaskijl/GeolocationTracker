import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-polylinedecorator";
import { useGameStore } from "@/lib/store";
import { TERRITORY_COLORS, BUILDINGS } from "@/lib/game"; // Added import for BUILDINGS

interface MilitaryMovement {
  fromCity: any;
  toCity: any;
  amount: number;
  marker: L.Marker;
  startTime: number;
  duration: number;
  pathLine?: L.Polyline;
}

export function Map() {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const polygonsRef = useRef<L.Layer[]>([]);
  const militaryMovementsRef = useRef<MilitaryMovement[]>([]);
  const animationFrameRef = useRef<number>();
  const { cities, setSelectedCity } = useGameStore();
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Initialize map once
  useEffect(() => {
    const container = document.getElementById("map");
    if (!container) {
      console.error("Map container not found");
      return;
    }

    console.log("Initializing map");
    mapRef.current = L.map("map", {
      center: [55.7558, 37.6173], // Moscow coordinates
      zoom: 6,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(mapRef.current);

    return () => {
      console.log("Cleaning up map");
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []); // Empty dependency array - only run once

  // Update markers and polygons when cities change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clean up existing markers and polygons
    markersRef.current.forEach((marker) => marker.remove());
    polygonsRef.current.forEach((polygon) => polygon.remove());
    markersRef.current = [];
    polygonsRef.current = [];

    // Add new markers and polygons
    cities.forEach((city) => {
      const color =
        TERRITORY_COLORS[city.owner as keyof typeof TERRITORY_COLORS];

      // Add territory polygon
      const polygon = L.polygon(city.boundaries, {
        color,
        fillColor: color,
        fillOpacity: 0.4,
        weight: 2,
      }).addTo(mapRef.current!);
      polygonsRef.current.push(polygon);

      // Add city label as a custom divIcon
      const marker = L.marker([city.latitude, city.longitude], {
        //icon: cityMarker, // Removed custom divIcon
      }).addTo(mapRef.current!)
        .on("click", () => {
          setSelectedCity(city);
          showCityInfo(city); // Show tooltip on click
        });


      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      polygonsRef.current.forEach((polygon) => polygon.remove());
    };
  }, [cities, setSelectedCity]);

  // Setup WebSocket for military movements
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const newWs = new WebSocket(`${protocol}//${window.location.host}/ws`);

    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "MILITARY_TRANSFER_START") {
        const { fromCity, toCity, amount, duration } = data;

        // Create military unit marker with custom icon
        const militaryIcon = L.divIcon({
          className: "military-marker",
          html: `<div style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: #ff4500; border-radius: 50%; border: 2px solid white; color: white; font-weight: bold;">${amount}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([fromCity.latitude, fromCity.longitude], {
          icon: militaryIcon,
        }).addTo(mapRef.current!);

        const pathLine = L.polyline(
          [
            [fromCity.latitude, fromCity.longitude],
            [toCity.latitude, toCity.longitude],
          ],
          {
            color: "blue",
            weight: 3,
          },
        ).addTo(mapRef.current!);

        militaryMovementsRef.current.push({
          fromCity,
          toCity,
          amount,
          marker,
          startTime: Date.now(),
          duration,
          pathLine,
        });

        // Start animation if not already running
        if (!animationFrameRef.current) {
          animate();
        }
      }
    };

    setWs(newWs);

    return () => {
      newWs.close();
    };
  }, []);

  const animate = () => {
    if (!mapRef.current) return;

    const currentTime = Date.now();
    militaryMovementsRef.current = militaryMovementsRef.current.filter(
      (movement) => {
        const progress = (currentTime - movement.startTime) / movement.duration;

        if (progress >= 1) {
          movement.marker.remove();
          if (movement.pathLine) movement.pathLine.remove();
          return false;
        }

        const lat =
          movement.fromCity.latitude +
          (movement.toCity.latitude - movement.fromCity.latitude) * progress;
        const lng =
          movement.fromCity.longitude +
          (movement.toCity.longitude - movement.fromCity.longitude) * progress;
        movement.marker.setLatLng([lat, lng]);
        if (movement.pathLine) {
          movement.pathLine.setLatLngs([
            [movement.fromCity.latitude, movement.fromCity.longitude],
            [lat, lng],
          ]);
        }

        return true;
      },
    );

    if (militaryMovementsRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  };

  // Added showCityInfo function
  const showCityInfo = (city: any) => {
    const cityInfo = document.createElement("div");
    cityInfo.className = "city-tooltip";

    let buildingsHTML = '';
    if (city.buildings && city.buildings.length > 0) {
      const buildingCounts: Record<string, number> = {};
      city.buildings.forEach((building: string) => {
        buildingCounts[building] = (buildingCounts[building] || 0) + 1;
      });

      buildingsHTML = '<p>Постройки:</p><div style="display: flex; flex-wrap: wrap; gap: 5px;">';
      Object.entries(buildingCounts).forEach(([buildingId, count]) => {
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (building) {
          buildingsHTML += `<span style="color: green;" title="${building.name}">${building.icon} ${count}</span>`;
        }
      });
      buildingsHTML += '</div>';

      if (city.availableBuildings && city.availableBuildings.length > 0) {
        buildingsHTML += '<p>Доступные постройки:</p><div style="display: flex; flex-wrap: wrap; gap: 5px;">';
        city.availableBuildings.forEach((buildingId: string) => {
          const building = BUILDINGS.find(b => b.id === buildingId);
          if (building) {
            const currentCount = (buildingCounts[buildingId] || 0);
            const limit = city.buildingLimits?.[buildingId] || 0;
            buildingsHTML += `<span style="color: gray;" title="${building.name}">${building.icon} ${currentCount}/${limit}</span>`;
          }
        });
        buildingsHTML += '</div>';
      }
    }

    cityInfo.innerHTML = `
      <h3>${city.name}</h3>
      <p>Население: ${city.population} / ${city.maxPopulation}</p>
      <p>Владелец: ${city.owner === 'player' ? 'Вы' : 'Нейтральный'}</p>
      ${buildingsHTML}
    `;
    document.body.appendChild(cityInfo);
  };


  return <div id="map" className="w-full h-screen" />;
}

export function getResourceIcon(resource: string): string {
  switch (resource) {
    case "gold":
      return "💰";
    case "wood":
      return "🌲";
    case "food":
      return "🍗";
    case "oil":
      return "🛢️";
    case "metal":
      return "⛏️";
    case "steel":
      return "🔩";
    case "weapons":
      return "⚔️";
    default:
      return "📦";
  }
}