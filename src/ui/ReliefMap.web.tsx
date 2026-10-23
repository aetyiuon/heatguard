import React, { useEffect, useMemo, useRef } from 'react';
import { ReliefTrail } from '../domain/types';
import { MapProps } from './maps.types';
import { pickedCoordinates } from '../domain/relief';
const EMPTY_TRAILS: ReliefTrail[] = [];
const EMPTY_REPORTS: NonNullable<MapProps['reports']> = [];
export default function ReliefMap({
  place,
  pins,
  onSelect,
  reports = EMPTY_REPORTS,
  heatLayer = false,
  heatRiskValidTime,
  trails = EMPTY_TRAILS,
  showLabels = true,
  city,
  showParks = true,
  focus,
  viewKey,
  picking = false,
  pickedPoint,
  onPickLocation,
}: MapProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const receive = (e: MessageEvent) => {
      if (e.source === ref.current?.contentWindow && picking) {
        const point = pickedCoordinates(e.data?.pickedPoint);
        if (point) onPickLocation?.(point);
      }
      if (e.source === ref.current?.contentWindow && typeof e.data?.pinId === 'string') {
        const pin = pins.find((p) => p.id === e.data.pinId);
        if (pin) onSelect(pin);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [pins, onSelect, picking, onPickLocation]);
  const html = useMemo(() => {
    const data = JSON.stringify({
      place,
      pins,
      reports,
      heatLayer,
      trails,
      showLabels,
      city: city
        ? {
            name: city.name,
            bounds: city.bounds,
            boundary: city.boundary,
            parks: city.parks,
            boundarySource: city.boundarySource,
            boundaryLabel: city.boundaryLabel,
            regions: city.regions,
          }
        : undefined,
      showParks,
      focus,
      picking,
      pickedPoint,
      time: heatRiskValidTime ? Date.parse(heatRiskValidTime) : null,
    }).replace(/</g, '\\u003c');
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#map{height:100%;margin:0;background:#e9eee0;font-family:system-ui}.leaflet-popup-content{font-size:13px}.marker{border:2px solid white;box-shadow:0 1px 6px #0004;border-radius:50%;width:23px;height:23px;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700}.place-label{font-size:11px;border:0;box-shadow:0 1px 4px #0002;color:#223D35;background:#fffcf3ed;padding:3px 5px;max-width:180px;overflow:hidden;text-overflow:ellipsis}.leaflet-control-attribution{font-size:10px}</style>
</head><body><div id="map" role="application" aria-label="Drinking fountains, shade shelters and trails"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const d=${data};
const map=L.map('map',{scrollWheelZoom:true,dragging:true,preferCanvas:true}).setView([d.place.latitude,d.place.longitude],15);
new ResizeObserver(()=>map.invalidateSize()).observe(document.getElementById('map'));
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);
const safeText=t=>{const el=document.createElement('span');el.textContent=t;return el;};
if(d.picking){document.getElementById('map').style.cursor='crosshair';map.on('click',e=>parent.postMessage({pickedPoint:{latitude:e.latlng.lat,longitude:e.latlng.lng}},'*'));}
const asBounds=b=>[[b[1],b[0]],[b[3],b[2]]];
if(d.city){L.geoJSON({type:'MultiPolygon',coordinates:d.city.boundary},{style:{color:'#7958A5',weight:2,fillOpacity:.015,dashArray:'7,5'}}).addTo(map).bindTooltip(safeText(d.city.boundaryLabel||d.city.name+' · city limits'));(d.city.regions||[]).forEach(r=>L.geoJSON({type:'MultiPolygon',coordinates:r.polygons},{style:{color:'#7B8585',weight:1,fillOpacity:0,dashArray:'3,5'}}).addTo(map).bindTooltip(safeText(r.name+' County · district portion')));if(d.showParks)d.city.parks.forEach(p=>L.geoJSON({type:'MultiPolygon',coordinates:p.polygons},{style:{color:'#70906C',weight:1,fillColor:'#8AB07B',fillOpacity:.16}}).addTo(map).bindTooltip(safeText(p.name+' · mapped park; shade unverified')).bindPopup(safeText(p.name+(p.address?' · '+p.address:'')+' · Mapped park boundary; not a shade measurement')));}
if(d.focus?.bounds)map.fitBounds(asBounds(d.focus.bounds),{padding:[25,25],maxZoom:16});else if(d.focus)map.setView([d.focus.latitude,d.focus.longitude],16);else if(d.city)map.fitBounds(asBounds(d.city.bounds),{padding:[12,12]});
if(!d.city)L.circleMarker([d.place.latitude,d.place.longitude],{radius:7,color:'#fff',fillColor:'#223D35',fillOpacity:1}).addTo(map).bindPopup(safeText(d.place.name+' · viewing location'));
if(d.pickedPoint)L.circleMarker([d.pickedPoint.latitude,d.pickedPoint.longitude],{radius:9,color:'#8B3F20',fillColor:'#FFB561',fillOpacity:1,weight:3}).addTo(map).bindTooltip(safeText('Your suggested location · unverified'));
d.trails.forEach(t=>t.paths.forEach(path=>L.polyline(path.map(p=>[p[1],p[0]]),{color:'#477C68',weight:3,dashArray:'5,4',opacity:.8}).addTo(map).bindTooltip(safeText(t.name+' · mapped trail; shade unverified'))));
const c={water:'#4587AD',shade:'#53864F',ac:'#D8633E','cooling-center':'#7A0E7F'},symbols={water:'W',shade:'S',ac:'AC','cooling-center':'+'};
const markers=L.layerGroup().addTo(map);let labels=[];
function addPin(p){
 const popup=document.createElement('div');popup.appendChild(safeText(p.name));popup.appendChild(document.createElement('br'));popup.appendChild(safeText(p.source));
 const marker=L.marker([p.latitude,p.longitude],{title:p.name,alt:p.name,icon:L.divIcon({className:'',html:'<div class="marker" style="background:'+c[p.kind]+'">'+symbols[p.kind]+'</div>',iconSize:[27,27]})}).addTo(markers).bindPopup(popup,{autoPan:false}).on('click',()=>parent.postMessage({pinId:p.id},'*'));
 marker.getElement().setAttribute('aria-label',p.name);
 const label=p.assetId&&p.kind==='water'?'Fountain #'+p.assetId:p.feature==='wooded-area'?'Potential tree shade':p.parkName&&p.kind==='shade'?p.name.split(' · ').pop():p.name;
 labels.push({marker,label,p});
}
function renderPins(){markers.clearLayers();labels=[];const bounds=map.getBounds().pad(.1),groups=new Map();d.pins.filter(p=>bounds.contains([p.latitude,p.longitude])).forEach(p=>{const xy=map.latLngToContainerPoint([p.latitude,p.longitude]),key=map.getZoom()<14?Math.floor(xy.x/45)+','+Math.floor(xy.y/45):p.id;const group=groups.get(key)||[];group.push(p);groups.set(key,group);});groups.forEach(group=>{if(group.length===1){addPin(group[0]);return;}const lat=group.reduce((s,p)=>s+p.latitude,0)/group.length,lon=group.reduce((s,p)=>s+p.longitude,0)/group.length,label=group.length+' mapped places · zoom to explore';const el=L.marker([lat,lon],{title:label,alt:label,icon:L.divIcon({className:'',html:'<div class="marker" style="background:#223D35;width:31px;height:31px">'+group.length+'</div>',iconSize:[35,35]})}).addTo(markers).bindTooltip(safeText(label)).on('click',()=>map.fitBounds(group.map(p=>[p.latitude,p.longitude]),{padding:[35,35],maxZoom:16}));el.getElement().setAttribute('aria-label',label);});updateLabels();}
// Prefer fountain labels and keep labels apart. Every marker still exposes its full name on hover/tap.
function updateLabels(){const occupied=[],size=map.getSize();labels.sort((a,b)=>(a.p.kind==='water'?0:a.p.feature==='shelter'?1:2)-(b.p.kind==='water'?0:b.p.feature==='shelter'?1:2)).forEach(({marker,label})=>{const point=map.latLngToContainerPoint(marker.getLatLng()),box={x:point.x+25,y:point.y-10,w:Math.min(180,label.length*6+14),h:22};const visible=d.showLabels&&box.x>0&&box.y>0&&box.x+box.w<size.x&&box.y+box.h<size.y&&!occupied.some(b=>box.x<b.x+b.w+4&&box.x+box.w+4>b.x&&box.y<b.y+b.h+4&&box.y+box.h+4>b.y);if(visible)occupied.push(box);marker.unbindTooltip().bindTooltip(safeText(label),{permanent:visible,direction:'right',offset:[12,0],className:'place-label'});});}
map.on('moveend',renderPins);renderPins();
d.reports.forEach(p=>L.circle([p.latitude,p.longitude],{radius:200,color:p.feeling==='very-hot'?'#E22F33':p.feeling==='hot'?'#F69632':'#4D9B59',fillOpacity:.2,weight:1}).addTo(map).bindPopup(safeText('Community report · '+p.feeling)));
if(d.heatLayer&&d.time){const HeatTiles=L.TileLayer.extend({getTileUrl:function(coords){const nw=map.options.crs.project(map.unproject(L.point(coords.x*256,coords.y*256),coords.z));const se=map.options.crs.project(map.unproject(L.point((coords.x+1)*256,(coords.y+1)*256),coords.z));return 'https://mapservices.weather.noaa.gov/experimental/rest/services/NWS_HeatRisk/ImageServer/exportImage?bbox='+[nw.x,se.y,se.x,nw.y].join(',')+'&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image&time='+d.time;}});new HeatTiles('',{opacity:.35}).addTo(map);}
</script></body></html>`;
  }, [
    place.latitude,
    place.longitude,
    place.name,
    pins,
    reports,
    heatLayer,
    heatRiskValidTime,
    trails,
    showLabels,
    city,
    showParks,
    focus,
    viewKey,
    picking,
    pickedPoint,
  ]);
  return React.createElement('iframe', {
    ref,
    title: 'Interactive relief map',
    srcDoc: html,
    sandbox: 'allow-scripts allow-same-origin',
    style: { width: '100%', height: 420, border: 0 },
    referrerPolicy: 'no-referrer',
  });
}
