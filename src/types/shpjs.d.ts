declare module 'shpjs' {
  function shp(input: string | ArrayBuffer): Promise<GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[]>;
  export = shp;
}
