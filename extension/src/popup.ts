console.log('Popup loaded');

document.addEventListener('DOMContentLoaded', () => {

  const globalPower = document.getElementById('globalPower') as HTMLButtonElement;
  const statusText = document.getElementById('statusText') as HTMLSpanElement;

  const aiPower = document.getElementById('aiPower') as HTMLButtonElement;
  const aiToggleGroup = document.getElementById('aiToggleGroup') as HTMLDivElement;

  const propagandaPower = document.getElementById('propagandaPower') as HTMLButtonElement;
  const propagandaGroup = document.getElementById('propagandaToggleGroup') as HTMLDivElement;

  let globalActive = true;
  let aiActive = true;
  let propagandaActive = false;

  function setGlobal(active: boolean) {
    globalActive = active;
    globalPower.setAttribute('data-active', String(active));
    globalPower.querySelector('.power-label')!.textContent = active ? 'ON' : 'OFF';

    if (active) {
      document.querySelector('.footer')?.classList.remove('status-paused');
      statusText.textContent = 'Scanning continuously';

      // 1. Re-enable Section Power buttons
      aiPower.removeAttribute('disabled');
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
      aiPower.setAttribute('disabled', 'true');
      propagandaPower.setAttribute('disabled', 'true');
    }
  }

  function setAi(active: boolean) {
    aiActive = active;
    aiPower.setAttribute('data-active', String(active));
    aiPower.querySelector('.power-label')!.textContent = active ? 'ON' : 'OFF';

    // Lock/Unlock the AI buttons based on BOTH section and global state
    if (active && globalActive) {
      aiToggleGroup.classList.remove('disabled');
      aiToggleGroup.querySelectorAll('button.toggle').forEach(btn => btn.removeAttribute('disabled'));
    } else {
      aiToggleGroup.classList.add('disabled');
      aiToggleGroup.querySelectorAll('button.toggle').forEach(btn => {
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
  });

  aiPower.addEventListener('click', () => {
    if (!globalActive) return; // Failsafe: can't toggle if global is off
    setAi(!aiActive);
  });

  aiToggleGroup.addEventListener('click', (e: Event) => {
    const btn = (e.target as HTMLElement).closest('button.toggle') as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;

    activateToggle(aiToggleGroup, btn);
  });

  propagandaPower.addEventListener('click', () => {
    if (!globalActive) return; // Failsafe: can't toggle if global is off
    setPropaganda(!propagandaActive);
  });

  propagandaGroup.addEventListener('click', (e: Event) => {
    const btn = (e.target as HTMLElement).closest('button.toggle') as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;

    activateToggle(propagandaGroup, btn);
  });

});