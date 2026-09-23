/* =======================================================
   Jakarta Film Summit — Home page behaviour
   Requires: common.js
   ======================================================= */

document.addEventListener('DOMContentLoaded', function(){
  var tabs = document.querySelectorAll('.day-tab');
  tabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      tabs.forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      document.querySelectorAll('.day-panel').forEach(function(p){
        p.classList.toggle('active', p.dataset.day === tab.dataset.day);
      });
    });
  });
});
