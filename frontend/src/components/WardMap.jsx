import { memo, useEffect, useMemo, useRef } from 'react';
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { tierFromScore, tierMeta } from '../config';

function FitBounds({ points, cityKey }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points.map((p) => [p.lat, p.lon]), { padding: [36, 36], animate: true, maxZoom: 13 });
    // refit only when the city or the ward set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey, points.length, map]);
  return null;
}

function FlyToSelected({ target }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (target) map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 12), { duration: 0.8 });
  }, [target, map]);
  return null;
}

/** items: [{ ward_id, ward_name, lat, lon, score, tier, cases }] */
function WardMap({ items, geojson, selectedId, onSelect, cityKey }) {
  const selected = items.find((i) => i.ward_id === selectedId);
  const byId = useMemo(() => Object.fromEntries(items.map((i) => [i.ward_id, i])), [items]);
  const sig = items.map((i) => i.tier[0]).join('');

  return (
    <MapContainer center={[23.78, 90.4]} zoom={11} scrollWheelZoom className="h-full w-full" style={{ borderRadius: 'inherit' }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds points={items} cityKey={cityKey} />
      <FlyToSelected target={selected} />
      {geojson && (
        <GeoJSON
          key={`${cityKey}-${sig}`} data={geojson}
          style={(f) => {
            const it = byId[f.properties?.ward_id];
            const color = it ? tierMeta(it.tier).color : '#888';
            return { color, weight: 1.5, fillColor: color, fillOpacity: 0.45 };
          }}
          onEachFeature={(f, layer) => layer.on('click', () => f.properties?.ward_id && onSelect(f.properties.ward_id))}
        />
      )}
      {items.map((it) => {
        const t = tierMeta(it.tier);
        const isSel = it.ward_id === selectedId;
        const radius = 6 + it.score * 11;
        return (
          <CircleMarker
            key={it.ward_id} center={[it.lat, it.lon]} radius={isSel ? radius + 3 : radius}
            pathOptions={{ color: isSel ? '#ffffff' : t.color, weight: isSel ? 3 : 1.5, fillColor: t.color, fillOpacity: isSel ? 0.95 : 0.7 }}
            eventHandlers={{ click: () => onSelect(it.ward_id) }}
          >
            <Tooltip className="dw-tip" direction="top" offset={[0, -6]}>
              <strong>{it.ward_name}</strong><br />{t.key} · score {it.score.toFixed(2)}
            </Tooltip>
          </CircleMarker>
        );
      })}
      {items.filter((i) => i.tier === 'Critical').map((it) => (
        <CircleMarker
          key={`ring-${it.ward_id}`} center={[it.lat, it.lon]} radius={6 + it.score * 11} interactive={false}
          pathOptions={{ color: '#e11d48', weight: 2, fill: false, className: 'pulse-ring' }}
        />
      ))}
    </MapContainer>
  );
}

export default memo(WardMap);
export { tierFromScore };
