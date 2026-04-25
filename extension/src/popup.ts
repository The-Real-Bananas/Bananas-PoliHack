console.log('Popup loaded');

document.addEventListener('DOMContentLoaded', () => {

  const globalPower = document.getElementById('globalPower') as HTMLButtonElement;
  const statusText = document.getElementById('statusText') as HTMLSpanElement;

  const photoFilterPower = document.getElementById('photoFilterPower') as HTMLButtonElement;
  const photoFilterGroup = document.getElementById('photoFilterGroup') as HTMLDivElement;

  const propagandaPower = document.getElementById('propagandaPower') as HTMLButtonElement;
  const propagandaGroup = document.getElementById('propagandaToggleGroup') as HTMLDivElement;

  let globalActive = true;
  let aiActive = true;
  let propagandaActive = false;

  async function sendToContent(payload: object) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) chrome.tabs.sendMessage(tab.id, payload);
  }

  function setGlobal(active: boolean) {
    globalActive = active;
    globalPower.setAttribute('data-active', String(active));
    globalPower.querySelector('.power-label')!.textContent = active ? 'ON' : 'OFF';

    if (active) {
      document.querySelector('.footer')?.classList.remove('status-paused');
      statusText.textContent = 'Scanning continuously';

      // 1. Re-enable Section Power buttons
      photoFilterPower.removeAttribute('disabled');
      propagandaPower.removeAttribute('disabled');

      // 2. Restore previous states for the sections
      setAi(aiActive);
      setPropaganda(propagandaActive);

    } else {
      document.querySelector('.footer')?.classList.add('status-paused');
      statusText.textContent = 'Extension paused';

      // 1. Automatically change sections to OFF (this locks their grids)
      setAi(false);
      setPropaganda(false);

      // 2. Disable Section Power buttons so they can't be toggled while Global is OFF
      photoFilterPower.setAttribute('disabled', 'true');
      propagandaPower.setAttribute('disabled', 'true');
    }
  }

  function setAi(active: boolean) {
    aiActive = active;
    photoFilterPower.setAttribute('data-active', String(active));
    photoFilterPower.querySelector('.power-label')!.textContent = active ? 'ON' : 'OFF';

    // Lock/Unlock the AI buttons based on BOTH section and global state
    if (active && globalActive) {
      photoFilterGroup.classList.remove('disabled');
      photoFilterGroup.querySelectorAll('button.toggle').forEach(btn => btn.removeAttribute('disabled'));
    } else {
      photoFilterGroup.classList.add('disabled');
      photoFilterGroup.querySelectorAll('button.toggle').forEach(btn => {
        btn.setAttribute('disabled', 'true');
      });
    }
  }

  function setPropaganda(active: boolean) {
    propagandaActive = active;
    propagandaPower.setAttribute('data-active', String(active));
    propagandaPower.querySelector('.power-label')!.textContent = active ? 'ON' : 'OFF';

    // Lock/Unlock the Propaganda buttons based on BOTH section and global state
    if (active && globalActive) {
      propagandaGroup.classList.remove('disabled');
      propagandaGroup.querySelectorAll('button.toggle').forEach(btn => btn.removeAttribute('disabled'));
    } else {
      propagandaGroup.classList.add('disabled');
      propagandaGroup.querySelectorAll('button.toggle').forEach(btn => {
        btn.setAttribute('disabled', 'true');
      });
    }
  }

  function activateToggle(group: HTMLDivElement, clicked: HTMLButtonElement) {
    group.querySelectorAll('button.toggle').forEach(b => b.classList.remove('active'));
    clicked.classList.add('active');
  }

  // Event Listeners
  globalPower.addEventListener('click', () => {
    setGlobal(!globalActive);
    sendToContent({ type: 'SET_GLOBAL', enabled: globalActive });
  });

  photoFilterPower.addEventListener('click', () => {
    if (!globalActive) return; // Failsafe: can't toggle if global is off
    setAi(!aiActive);
    sendToContent({ type: 'SET_PHOTO_FILTER', enabled: aiActive });
  });

  photoFilterGroup.addEventListener('click', (e: Event) => {
    const btn = (e.target as HTMLElement).closest('button.toggle') as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;

    activateToggle(photoFilterGroup, btn);
    sendToContent({ type: 'SET_PHOTO_FILTER_MODE', mode: btn.dataset.mode }); // 'flag' | 'blur' | 'hide'
  });

  propagandaPower.addEventListener('click', () => {
    if (!globalActive) return; // Failsafe: can't toggle if global is off
    setPropaganda(!propagandaActive);
    sendToContent({ type: 'SET_PROPAGANDA', enabled: propagandaActive });
  });

  propagandaGroup.addEventListener('click', (e: Event) => {
    const btn = (e.target as HTMLElement).closest('button.toggle') as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;

    activateToggle(propagandaGroup, btn);
    sendToContent({ type: 'SET_PROPAGANDA_MODE', mode: btn.dataset.mode });
  });

});