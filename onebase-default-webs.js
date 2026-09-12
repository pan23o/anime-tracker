/* OneBase · Compatibilidad histórica
   La gestión de fuentes pertenece exclusivamente a onebase-source-search-v2.js.
   Este archivo se mantiene como shim para instalaciones antiguas que todavía lo cargan.
   No inyecta botones ni registra observers para evitar duplicados (especialmente SubPlease).
*/
(function(){'use strict';
  if(!window.OneBaseSourceFailure){
    window.OneBaseSourceFailure=function(source,retry){
      if(typeof retry==='function')retry();
    };
  }
})();
