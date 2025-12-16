// Language switch with cookie and reload support
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    // Get current language from HTML lang attribute
    const currentLang = document.documentElement.lang === 'zh-CN' ? 'zh' : 'en';
    
    // Mark active language button
    const langButtons = document.querySelectorAll('.lang-option');
    langButtons.forEach(btn => {
      if (btn.dataset.lang === currentLang) {
        btn.classList.add('active');
      }
      
      // Add click handler
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const targetLang = btn.dataset.lang;
        
        // Don't reload if already on this language
        if (targetLang === currentLang) {
          return;
        }
        
        // Set cookie and reload
        document.cookie = `chatroom_language=${targetLang}; path=/; max-age=31536000`;
        
        // Show message based on target language
        const message = targetLang === 'zh' 
          ? 'Switching to Chinese, page will refresh...'
          : '切换到英文，页面即将刷新...';
        
        alert(message);
        
        // Reload with language parameter
        window.location.href = `/?lang=${targetLang}`;
      });
    });
  });
})();
