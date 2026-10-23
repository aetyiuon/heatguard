import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundledCity, insidePolygons } from '../src/domain/cities';
import { handleRequest } from '../backend/app';
import { polygonArea } from '../scripts/district-geometry';
import { polygonClipping } from '../scripts/geometry-vendor';

test('TX-06 dataset retains the verified Congress version, all nine counties and communities beyond DFW',async()=>{
  const d=await bundledCity('tx06');
  assert.equal(d.areaType,'congressional-district');
  assert.match(d.boundaryVersion!,/119th Congress/);
  assert.deepEqual(d.regions?.map(r=>r.name),['Anderson','Cherokee','Dallas','Ellis','Freestone','Hill','Johnson','Navarro','Tarrant']);
  for(const name of ['Waxahachie','Corsicana','Hillsboro','Palestine','Jacksonville','Rusk','Alto','Whitney'])assert.ok(d.localities?.some(l=>l.name===name),name);
  assert.ok(d.bounds[0]<-97.4 && d.bounds[2]>-95 && d.bounds[1]<31.5 && d.bounds[3]>32.8);
  assert.ok(d.regions!.every(r=>r.parkCount>0));
  assert.ok(polygonArea(polygonClipping.difference(d.boundary,...d.regions!.map(r=>r.polygons)))/polygonArea(d.boundary)<.0001);
});

test('all TX-06 amenities and park shapes are inside the district, including clipped cross-border parks',async()=>{
  const d=await bundledCity('tx06');
  assert.equal(new Set(d.pins.map(p=>p.id)).size,d.pins.length);
  for(const p of d.pins){assert.ok(insidePolygons(p.longitude,p.latitude,d.boundary),p.id);assert.equal(p.status,'unknown');assert.equal(p.official,false);assert.ok(p.sourceUrl);}
  for(const p of d.parks){assert.ok(p.polygons.length,p.id);assert.ok(polygonArea(polygonClipping.difference(p.polygons,d.boundary))<1e-8,p.id);}
  for(const t of d.trails)for(const path of t.paths)for(let i=1;i<path.length;i++){
    const a=path[i-1]!,b=path[i]!;
    assert.ok(insidePolygons((a[0]+b[0])/2,(a[1]+b[1])/2,d.boundary),t.id);
  }
});

test('incomplete district community-data collection is explicit and never reported as completed coverage',async()=>{
  const d=await bundledCity('tx06');
  const c=d.coverage!;
  if(c.status==='baseline'){
    assert.equal(c.completedSections,0);assert.equal(c.boundaryCoverage,0);
    assert.ok(d.warnings.some(w=>/incomplete/i.test(w)));
    assert.ok(d.pins.filter(p=>p.provenance==='osm').every(p=>Date.parse(p.updatedAt)<Date.parse(d.fetchedAt)));
  }else{assert.equal(c.completedSections,c.totalSections);assert.ok(c.boundaryCoverage>.999999);}
  assert.ok(d.sources.some(s=>s.name.includes('USGS')));
  assert.ok(d.sources.some(s=>s.name.includes('Texas Parks')));
});

test('district API returns the full dataset, preserves source dates, and rejects conflicting scope parameters',async()=>{
  const r=await handleRequest(new Request('https://test/relief?district=tx06',{headers:{Origin:'http://localhost:8081'}}));
  const d=await r.json();
  assert.equal(r.status,200);assert.equal(d.city,'tx06');assert.equal(d.regions.length,9);assert.equal(d.localities.length,89);
  assert.equal(d.fetchedAt,(await bundledCity('tx06')).fetchedAt);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'),'http://localhost:8081');
  for(const query of ['district=6','district=tx06&city=dallas','district='])assert.equal((await handleRequest(new Request('https://test/relief?'+query))).status,400);
});
