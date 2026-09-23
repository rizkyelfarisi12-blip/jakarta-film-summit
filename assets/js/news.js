/* =======================================================
   Jakarta Film Summit — News & Media page behaviour
   Requires: common.js
   ======================================================= */

document.addEventListener('DOMContentLoaded', function(){
  var chips = document.querySelectorAll('.filter-chip');
  var rows = document.querySelectorAll('.news-row');
  chips.forEach(function(chip){
    chip.addEventListener('click', function(){
      chips.forEach(function(c){ c.classList.remove('active'); });
      chip.classList.add('active');
      var f = chip.dataset.filter;
      rows.forEach(function(row){
        var show = (f === 'all' || row.dataset.cat === f);
        row.classList.toggle('hide', !show);
      });
    });
  });
});
