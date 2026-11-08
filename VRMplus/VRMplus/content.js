/* * ==========================================
 * VRM2test - Quick Zoom & Battery Timer
 * Created by Stoyan Georgiev
 * ==========================================
 */

let navigationStack = []; 
let pendingZoomData = null; 

// Buffer for smoothing power fluctuations
let powerHistory = [];

// Default configuration settings
let config = {
    totalCapacityAh: 600,
    voltage: 51.2,
    bufferSize: 5,
    minSoc: 20
};

// ==========================================
// PART 1: CHART ZOOM LOGIC (ORIGINAL CODE)
// ==========================================

document.addEventListener('mouseover', function(e) {
    const tooltipTitle = document.querySelector('.highcharts-tooltip__title');
    if (tooltipTitle) {
        const rawText = tooltipTitle.textContent.trim();
        const parts = rawText.match(/(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2})\s-\s(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2})/);
        if (parts) {
            pendingZoomData = {
                startD: parts[1], startT: parts[2],
                endD:   parts[3], endT:   parts[4]
            };
        }
    } else {
        pendingZoomData = null; 
    }
});

document.addEventListener('click', function(e) {
    if (pendingZoomData && e.target.closest('.highcharts-container')) {
        const fromD = document.getElementById('dpMin');
        const toD = document.getElementById('dpMax');
        const times = document.querySelectorAll('.vrm-date-time-picker__dropdown__custom-time');

        if (fromD && toD && times.length >= 2) {
            const currentView = {
                startD: fromD.value, startT: times[0].value,
                endD:   toD.value,   endT:   times[1].value
            };

            const lastView = navigationStack[navigationStack.length - 1];
            if (!lastView || lastView.startD !== currentView.startD) {
                navigationStack.push(currentView);
            }

            simulateHumanChange(fromD, pendingZoomData.startD);
            simulateHumanChange(times[0], pendingZoomData.startT);
            
            setTimeout(() => {
                simulateHumanChange(toD, pendingZoomData.endD);
                simulateHumanChange(times[1], pendingZoomData.endT);
            }, 50);
        }
    }
}, true);

document.addEventListener('contextmenu', function(e) {
    if (e.target.closest('.highcharts-container')) {
        e.preventDefault(); 

        if (navigationStack.length > 0) {
            const fromD = document.getElementById('dpMin');
            const toD = document.getElementById('dpMax');
            const times = document.querySelectorAll('.vrm-date-time-picker__dropdown__custom-time');

            const previousView = navigationStack.pop(); 
            simulateHumanChange(fromD, previousView.startD);
            simulateHumanChange(times[0], previousView.startT);
            
            setTimeout(() => {
                simulateHumanChange(toD, previousView.endD);
                simulateHumanChange(times[1], previousView.endT);
            }, 50);
        }
    }
}, true);

function simulateHumanChange(el, val) {
    if (!el) return;
    el.focus();
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
}


// ==========================================
// PART 2: BATTERY TIME-TO-GO WIDGET & SETTINGS
// ==========================================

function loadConfigAndInit() {
    chrome.storage.sync.get(['totalCapacityAh', 'voltage', 'bufferSize', 'minSoc'], (result) => {
        if (result.totalCapacityAh) config.totalCapacityAh = result.totalCapacityAh;
        if (result.voltage) config.voltage = result.voltage;
        if (result.bufferSize) config.bufferSize = result.bufferSize;
        if (result.minSoc !== undefined) config.minSoc = result.minSoc;

        createBatteryTimerWidget();
        setInterval(calculateTime, 3000);
    });
}

function createBatteryTimerWidget() {
    if (document.getElementById('vrm2-battery-timer-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'vrm2-battery-timer-widget';
    widget.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 99999;
        background: rgba(33, 37, 41, 0.95);
        color: #fff;
        padding: 12px 14px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        border: 1px solid rgba(255,255,255,0.15);
        backdrop-filter: blur(5px);
        width: 240px;
    `;
    
    widget.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span id="vrm2-title">Battery Timer</span>
            <div>
                <span id="vrm2-status" style="color: #4cd137; font-size: 11px; margin-right: 6px;">Active</span>
                <button id="vrm2-gear-btn" style="background: none; border: none; color: #fff; cursor: pointer; font-size: 14px;" title="Settings">⚙️</button>
            </div>
        </div>
        
        <div id="vrm2-time-output" style="font-size: 15px; font-weight: bold; color: #00d2d3; margin-bottom: 2px;">Calculating...</div>
        <div id="vrm2-energy-output" style="font-size: 12px; color: #a4b0be; margin-bottom: 4px;text-align: center;">-- / -- kWh</div>

        <!-- SETTINGS PANEL -->
        <div id="vrm2-settings-panel" style="display: none; margin-top: 8px; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 8px; font-size: 12px;">
            <div style="margin-bottom: 5px;">
                <label style="display: block; color: #ccc;">Capacity (Ah):</label>
                <input type="number" id="vrm2-cap-input" value="${config.totalCapacityAh}" style="width: 100%; background: #222; color: #fff; border: 1px solid #555; padding: 3px; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 5px;">
                <label style="display: block; color: #ccc;">Voltage (V):</label>
                <input type="number" step="0.1" id="vrm2-volt-input" value="${config.voltage}" style="width: 100%; background: #222; color: #fff; border: 1px solid #555; padding: 3px; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 5px;">
                <label style="display: block; color: #ccc;">Min SOC Target (%):</label>
                <input type="number" id="vrm2-minsoc-input" value="${config.minSoc}" min="0" max="100" style="width: 100%; background: #222; color: #fff; border: 1px solid #555; padding: 3px; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: block; color: #ccc;">
                    Smoothing Buffer: 
                    <span id="vrm2-time-label" style="color: #00d2d3; font-weight: bold;">(Avg over ~${formatBufferTime(config.bufferSize)})</span>
                </label>
                <input type="number" id="vrm2-buffer-input" value="${config.bufferSize}" min="1" style="width: 100%; background: #222; color: #fff; border: 1px solid #555; padding: 3px; border-radius: 4px;">
            </div>
            <button id="vrm2-save-btn" style="width: 100%; background: #00d2d3; color: #000; border: none; padding: 5px; font-weight: bold; border-radius: 4px; cursor: pointer;">Save Settings</button>
        </div>
    `;
    
    document.body.appendChild(widget);

    document.getElementById('vrm2-gear-btn').addEventListener('click', () => {
        const panel = document.getElementById('vrm2-settings-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    const bufferInput = document.getElementById('vrm2-buffer-input');
    bufferInput.addEventListener('input', (e) => {
        const count = parseInt(e.target.value) || 1;
        document.getElementById('vrm2-time-label').textContent = `(Avg over ~${formatBufferTime(count)})`;
    });

    document.getElementById('vrm2-save-btn').addEventListener('click', () => {
        const newCap = parseFloat(document.getElementById('vrm2-cap-input').value);
        const newVolt = parseFloat(document.getElementById('vrm2-volt-input').value);
        const newMinSoc = parseInt(document.getElementById('vrm2-minsoc-input').value);
        const newBuf = parseInt(document.getElementById('vrm2-buffer-input').value);

        if (!isNaN(newCap) && !isNaN(newVolt) && !isNaN(newMinSoc) && !isNaN(newBuf)) {
            config.totalCapacityAh = newCap;
            config.voltage = newVolt;
            config.minSoc = newMinSoc;
            config.bufferSize = newBuf;

            chrome.storage.sync.set({
                totalCapacityAh: newCap,
                voltage: newVolt,
                minSoc: newMinSoc,
                bufferSize: newBuf
            }, () => {
                const status = document.getElementById('vrm2-status');
                status.textContent = "Saved!";
                setTimeout(() => { status.textContent = "Active"; }, 2000);
                document.getElementById('vrm2-settings-panel').style.display = 'none';
            });
        }
    });
}

function formatBufferTime(bufferCount) {
    const totalSeconds = bufferCount * 3;
    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    } else {
        const mins = (totalSeconds / 60).toFixed(1);
        return `${mins}m`;
    }
}

function parseVRMBatteryData() {
    let soc = null;
    let minSoc = config.minSoc; 
    let powerWatts = null;

    // Target exact Victron power element using 'bp'
    const bpElement = document.querySelector('[ng-if*="isPropertyValid(\'bp\')"], [ng-if*=\'isPropertyValid("bp")\']');
    if (bpElement) {
        let text = bpElement.textContent.trim();
        let powerMatch = text.match(/([+-]?\d{1,5}(,\d{3})*(\.\d+)?)\s*(W|kW)/i);
        if (powerMatch) {
            let cleanNum = parseFloat(powerMatch[1].replace(/,/g, ''));
            let unit = powerMatch[4].toUpperCase();
            powerWatts = unit === 'KW' ? cleanNum * 1000 : cleanNum;
        }
    }

    // Scan elements for current State of Charge (%)
    const allElements = document.querySelectorAll('span, div, .subtitle, [ng-bind]');
    for (let el of allElements) {
        let text = el.textContent.trim();
        let socMatch = text.match(/^(\d{1,3}(\.\d+)?)\s*\%$/);
        if (socMatch && soc === null) {
            let val = parseFloat(socMatch[1]);
            if (val >= 0 && val <= 100) {
                soc = val;
            }
        }
    }

    if (soc === null) {
        for (let el of allElements) {
            let text = el.textContent.trim();
            let socMatch = text.match(/^(\d{1,3})\s*\%$/);
            if (socMatch) {
                let val = parseFloat(socMatch[1]);
                if (val >= 0 && val <= 100 && val !== minSoc) {
                    soc = val;
                    break;
                }
            }
        }
    }

    if (powerWatts !== null && soc === null) {
        soc = 50; // fallback placeholder
    }

    return { soc, minSoc, powerWatts };
}

function calculateTime() {
    const data = parseVRMBatteryData();
    const outputEl = document.getElementById('vrm2-time-output');
    const energyOutputEl = document.getElementById('vrm2-energy-output');
    const statusEl = document.getElementById('vrm2-status');

    if (!outputEl) return;

    const totalEnergyWh = config.totalCapacityAh * config.voltage;
    const totalEnergyKWh = totalEnergyWh / 1000;

    if (data.soc !== null && energyOutputEl) {
        const storedEnergyWh = totalEnergyWh * (data.soc / 100);
        const storedEnergyKWh = storedEnergyWh / 1000;
        energyOutputEl.textContent = `${storedEnergyKWh.toFixed(1)} / ${totalEnergyKWh.toFixed(1)} kWh`;
    }

    if (data.powerWatts === null) {
        outputEl.textContent = "Waiting for live data...";
        if (statusEl) statusEl.textContent = "Idle/Standby";
        return;
    }

    // --- DYNAMIC SMOOTHING BUFFER ---
    powerHistory.push(data.powerWatts);
    if (powerHistory.length > config.bufferSize) {
        powerHistory.shift(); 
    }
    if (powerHistory.length > config.bufferSize) {
        powerHistory = powerHistory.slice(-config.bufferSize);
    }

    const smoothedPower = powerHistory.reduce((a, b) => a + b, 0) / powerHistory.length;

    if (Math.abs(smoothedPower) < 5) {
        outputEl.textContent = `Standby (${data.soc}%)`;
        if (statusEl) {
            statusEl.textContent = "Idle";
            statusEl.style.color = "#ffa502";
        }
        return;
    }

    if (smoothedPower < 0) {
        // Discharging (Calculate time remaining until MINIMUM SOC is reached)
        if (data.soc <= data.minSoc) {
            outputEl.textContent = `At Min SOC (${data.soc}%)`;
            if (statusEl) {
                statusEl.textContent = "Limit Reached";
                statusEl.style.color = "#ffa502";
            }
            return;
        }

        const usableSocPercentage = data.soc - data.minSoc;
        const usableEnergyWh = totalEnergyWh * (usableSocPercentage / 100);
        const dischargePower = Math.abs(smoothedPower);
        const hoursRemaining = usableEnergyWh / dischargePower;

        outputEl.textContent = `${formatHours(hoursRemaining)} to empty (${data.minSoc}%)`;
        if (statusEl) {
            statusEl.textContent = "Discharging";
            statusEl.style.color = "#ff4757";
        }
    } else {
        // Charging (Calculate time remaining until 100% full)
        const energyNeededWh = totalEnergyWh * ((100 - data.soc) / 100);
        const hoursRemaining = energyNeededWh / smoothedPower;

        outputEl.textContent = `${formatHours(hoursRemaining)} to 100% (${data.soc}%)`;
        if (statusEl) {
            statusEl.textContent = "Charging";
            statusEl.style.color = "#2ed573";
        }
    }
}

function formatHours(decimalHours) {
    if (decimalHours <= 0) return '0m';
    if (!isFinite(decimalHours) || decimalHours > 999) return '> 99h';

    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);

    if (hours > 48) {
        return `${(hours / 24).toFixed(1)} days`;
    }

    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Initialize widget loop once page loads
window.addEventListener('load', () => {
    loadConfigAndInit();
});