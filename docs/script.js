/* ==========================================================================
   TEHILIM MCP — LANDING PAGE SCRIPTS
   ========================================================================== */

(function () {
  'use strict';

  // ---- Monthly Tehilim Schedule (Hebrew day → [firstChapter, lastChapter]) ----
  const SCHEDULE = {
    1:[1,9],2:[10,17],3:[18,22],4:[23,28],5:[29,34],6:[35,38],7:[39,43],
    8:[44,48],9:[49,54],10:[55,59],11:[60,65],12:[66,68],13:[69,71],
    14:[72,76],15:[77,78],16:[79,82],17:[83,87],18:[88,89],19:[90,96],
    20:[97,103],21:[104,105],22:[106,107],23:[108,112],24:[113,118],
    25:[119,119],26:[119,119],27:[120,134],28:[135,139],29:[140,144],
    30:[145,150]
  };

  // ---- Hebrew number names for display ----
  const HEBREW_DAY_NAMES = {
    1:'א׳',2:'ב׳',3:'ג׳',4:'ד׳',5:'ה׳',6:'ו׳',7:'ז׳',8:'ח׳',9:'ט׳',
    10:'י׳',11:'י״א',12:'י״ב',13:'י״ג',14:'י״ד',15:'ט״ו',16:'ט״ז',
    17:'י״ז',18:'י״ח',19:'י״ט',20:'כ׳',21:'כ״א',22:'כ״ב',23:'כ״ג',
    24:'כ״ד',25:'כ״ה',26:'כ״ו',27:'כ״ז',28:'כ״ח',29:'כ״ט',30:'ל׳'
  };

  /* ======================================================================
     LANGUAGE DETECTION & SWITCHING
     ====================================================================== */

  function detectLanguage() {
    var stored = localStorage.getItem('tehilim-lang');
    if (stored === 'he' || stored === 'en') return stored;
    if (navigator.language && navigator.language.startsWith('he')) return 'he';
    return 'en';
  }

  function setLanguage(lang) {
    var html = document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
    localStorage.setItem('tehilim-lang', lang);
  }

  function initLanguage() {
    var lang = detectLanguage();
    setLanguage(lang);

    var toggle = document.getElementById('lang-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('lang');
        var next = current === 'en' ? 'he' : 'en';
        setLanguage(next);
        // Re-render reading info with new language
        renderReadingHeader(getHebrewDay());
      });
    }
  }

  /* ======================================================================
     HEBREW DATE + TODAY'S READING
     ====================================================================== */

  function getHebrewDay() {
    try {
      var formatter = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric' });
      var parts = formatter.formatToParts(new Date());
      var dayPart = parts.find(function (p) { return p.type === 'day'; });
      return parseInt(dayPart.value, 10);
    } catch (e) {
      return 1;
    }
  }

  function getHebrewDateString() {
    try {
      var formatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      return formatter.format(new Date());
    } catch (e) {
      return '';
    }
  }

  function renderReadingHeader(hebrewDay) {
    var dateEl = document.getElementById('reading-date');
    var psalmsEl = document.getElementById('reading-psalms');
    if (!dateEl || !psalmsEl) return;

    var schedule = SCHEDULE[hebrewDay] || SCHEDULE[1];
    var firstCh = schedule[0];
    var lastCh = schedule[1];

    var lang = document.documentElement.getAttribute('lang');
    var hebrewDayName = HEBREW_DAY_NAMES[hebrewDay] || hebrewDay;
    var hebrewDateStr = getHebrewDateString();

    if (lang === 'he') {
      dateEl.textContent = 'יום ' + hebrewDayName + ' בחודש';
      if (firstCh === lastCh) {
        psalmsEl.textContent = 'תהילים פרק ' + firstCh;
      } else {
        psalmsEl.textContent = 'תהילים פרקים ' + firstCh + '–' + lastCh;
      }
    } else {
      dateEl.textContent = hebrewDateStr || ('Day ' + hebrewDay);
      if (firstCh === lastCh) {
        psalmsEl.textContent = 'Psalm ' + firstCh;
      } else {
        psalmsEl.textContent = 'Psalms ' + firstCh + '–' + lastCh;
      }
    }
  }

  function fetchPreview(hebrewDay) {
    var previewEl = document.getElementById('reading-preview');
    if (!previewEl) return;

    var schedule = SCHEDULE[hebrewDay] || SCHEDULE[1];
    var chapter = schedule[0];

    var url = 'https://www.sefaria.org/api/texts/Psalms.' + chapter + '?context=0&pad=0';

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var heVerses = data.he || [];
        var enVerses = data.text || [];
        var count = Math.min(3, heVerses.length, enVerses.length);

        if (count === 0) throw new Error('No verses');

        var html = '';
        for (var i = 0; i < count; i++) {
          html += '<div class="verse">';
          html += '<div class="verse-he">' + stripTags(heVerses[i]) + '</div>';
          html += '<div class="verse-en">' + stripTags(enVerses[i]) + '</div>';
          html += '</div>';
        }
        html += '<a class="sefaria-link" href="https://www.sefaria.org/Psalms.' + chapter +
                '?lang=bi" target="_blank" rel="noopener">' +
                (document.documentElement.getAttribute('lang') === 'he'
                  ? 'קרא את הפרק המלא בספריא &#x2192;'
                  : 'Read the full chapter on Sefaria &#x2192;') +
                '</a>';

        previewEl.innerHTML = html;
      })
      .catch(function () {
        var schedule2 = SCHEDULE[hebrewDay] || SCHEDULE[1];
        previewEl.innerHTML =
          '<a class="sefaria-link" href="https://www.sefaria.org/Psalms.' +
          schedule2[0] + '?lang=bi" target="_blank" rel="noopener">' +
          (document.documentElement.getAttribute('lang') === 'he'
            ? 'קרא את התהילים של היום בספריא &#x2192;'
            : 'Read today\'s Psalms on Sefaria &#x2192;') +
          '</a>';
      });
  }

  function stripTags(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  /* ======================================================================
     INSTALLATION TABS
     ====================================================================== */

  function initTabs() {
    var tabs = document.querySelectorAll('.tab');
    var panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');

        tabs.forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        panels.forEach(function (p) {
          p.classList.remove('active');
          p.hidden = true;
        });

        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        var panel = document.getElementById('panel-' + target);
        if (panel) {
          panel.classList.add('active');
          panel.hidden = false;
        }
      });

      // Keyboard navigation
      tab.addEventListener('keydown', function (e) {
        var tabArray = Array.from(tabs);
        var idx = tabArray.indexOf(tab);
        var next;

        if (e.key === 'ArrowRight') {
          next = tabArray[(idx + 1) % tabArray.length];
        } else if (e.key === 'ArrowLeft') {
          next = tabArray[(idx - 1 + tabArray.length) % tabArray.length];
        }

        if (next) {
          e.preventDefault();
          next.focus();
          next.click();
        }
      });
    });
  }

  /* ======================================================================
     COPY TO CLIPBOARD
     ====================================================================== */

  function initCopyButtons() {
    var buttons = document.querySelectorAll('.copy-btn');

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy');
        if (!text) return;

        // Decode HTML entities in data-copy (e.g. &#10; → newline)
        var tmp = document.createElement('textarea');
        tmp.innerHTML = text;
        var decoded = tmp.value;

        navigator.clipboard.writeText(decoded).then(function () {
          btn.classList.add('copied');
          setTimeout(function () {
            btn.classList.remove('copied');
          }, 2000);
        }).catch(function () {
          // Fallback for older browsers
          var textarea = document.createElement('textarea');
          textarea.value = decoded;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          try { document.execCommand('copy'); } catch (e) { /* noop */ }
          document.body.removeChild(textarea);
          btn.classList.add('copied');
          setTimeout(function () {
            btn.classList.remove('copied');
          }, 2000);
        });
      });
    });
  }

  /* ======================================================================
     SMOOTH SCROLL CTA
     ====================================================================== */

  function initSmoothScroll() {
    var cta = document.getElementById('cta-button');
    if (!cta) return;

    cta.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById('installation');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  /* ======================================================================
     INIT
     ====================================================================== */

  function init() {
    initLanguage();

    var hebrewDay = getHebrewDay();
    renderReadingHeader(hebrewDay);
    fetchPreview(hebrewDay);

    initTabs();
    initCopyButtons();
    initSmoothScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
