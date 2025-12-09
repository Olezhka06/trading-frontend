// ===== TRADE LINES RENDERER (SL/TP) WITH ORDER ID LABELS =====

class TradeLinesRenderer {
    constructor(tradeLines, series, chart) {
        this._tradeLines = tradeLines;
        this._series = series;
        this._chart = chart;
    }

    draw(target) {
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            
            if (!this._tradeLines || this._tradeLines.size === 0) {
                return;
            }

            const timeScale = this._chart.timeScale();
            const visibleRange = timeScale.getVisibleLogicalRange();
            
            if (!visibleRange) return;

            // Iterate over entries() to get the orderId (the key)
            for (const [orderId, trade] of this._tradeLines.entries()) {
                // Draw Stop Loss (red)
                this._drawLine(
                    ctx, 
                    scope, 
                    trade.stop_loss, 
                    '#ef5350', 
                    'SL',
                    orderId
                );
                
                // Draw Take Profit (green)
                this._drawLine(
                    ctx, 
                    scope, 
                    trade.take_profit, 
                    '#26a69a', 
                    'TP',
                    orderId
                );
            }
        });
    }

    _drawLine(ctx, scope, price, color, label, orderId) {
        const y = this._series.priceToCoordinate(price);
        
        if (y === null) return;

        const yPx = y * scope.verticalPixelRatio;
        const width = scope.bitmapSize.width;

        // 1. Draw Line (Using Line dash)
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 * scope.verticalPixelRatio;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        ctx.moveTo(0, yPx);
        ctx.lineTo(width, yPx);
        ctx.stroke();
        
        ctx.setLineDash([]);

        // 2. Draw Label with Order ID
        ctx.font = `bold ${12 * scope.verticalPixelRatio}px sans-serif`;
        
        // Format: "SL (ID:15)" or "TP (ID:15)"
        const labelText = `${label} (ID:${orderId})`;
        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const padding = 6 * scope.horizontalPixelRatio;
        const textHeight = 16 * scope.verticalPixelRatio;
        
        // Position the label on the RIGHT edge
        const labelX = width - textWidth - padding * 2 - (10 * scope.horizontalPixelRatio);
        const labelY = yPx - textHeight / 2;

        // Background (dark, slightly transparent)
        ctx.fillStyle = 'rgba(19, 23, 34, 0.95)';
        ctx.fillRect(labelX, labelY, textWidth + padding * 2, textHeight);

        // Border around label
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(labelX, labelY, textWidth + padding * 2, textHeight);

        // Text
        ctx.fillStyle = color;
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, labelX + padding, labelY + textHeight / 2);
    }
}

class TradeLinesPaneView {
    constructor(tradeLines, series, chart) {
        this._tradeLines = tradeLines;
        this._series = series;
        this._chart = chart;
    }

    update(tradeLines) {
        this._tradeLines = tradeLines;
    }

    renderer() {
        return new TradeLinesRenderer(this._tradeLines, this._series, this._chart);
    }
}

class TradeLinesPrimitive {
    constructor(chart, series, tradeLinesRef) {
        this._chart = chart;
        this._series = series;
        this._tradeLinesRef = tradeLinesRef;
        this._paneViews = [new TradeLinesPaneView(new Map(), series, chart)];
    }

    updateAllViews() {
        const tradeLines = this._tradeLinesRef();
        this._paneViews[0].update(tradeLines);
    }

    paneViews() {
        return this._paneViews;
    }
}

// ===== ZONE RENDERING WITH TIMESTAMP-BASED COORDINATES =====

class ZonesPaneRenderer {
    constructor(zones, chart, series, latestTime) {
        this._zones = zones;
        this._chart = chart;
        this._series = series;
        this._latestTime = latestTime;
    }

    draw(target) {
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            
            if (!this._zones || this._zones.length === 0) {
                return;
            }

            const timeScale = this._chart.timeScale();

            for (const zone of this._zones) {
                const y1 = this._series.priceToCoordinate(zone.high);
                const y2 = this._series.priceToCoordinate(zone.low);
                
                if (y1 === null || y2 === null) {
                    continue;
                }

                const xStart = timeScale.timeToCoordinate(zone.start_time);
                
                let xEnd;
                if (zone.active) {
                    if (this._latestTime) {
                        xEnd = timeScale.timeToCoordinate(this._latestTime);
                        
                        if (xEnd === null) {
                            const visibleRange = timeScale.getVisibleLogicalRange();
                            if (visibleRange) {
                                xEnd = timeScale.logicalToCoordinate(visibleRange.to);
                            } else {
                                xEnd = scope.bitmapSize.width;
                            }
                        }
                    } else {
                        const visibleRange = timeScale.getVisibleLogicalRange();
                        if (visibleRange) {
                            xEnd = timeScale.logicalToCoordinate(visibleRange.to);
                        } else {
                            xEnd = scope.bitmapSize.width;
                        }
                    }
                } else {
                    if (zone.end_time) {
                        xEnd = timeScale.timeToCoordinate(zone.end_time);
                    } else {
                        xEnd = xStart + 50;
                    }
                }

                if (xStart === null || xEnd === null) {
                    continue;
                }

                if (xEnd < 0 || xStart > scope.bitmapSize.width) {
                    continue;
                }

                const yTop = y1 * scope.verticalPixelRatio;
                const yBottom = y2 * scope.verticalPixelRatio;
                const height = yBottom - yTop;
                
                const xStartPx = xStart * scope.horizontalPixelRatio;
                const xEndPx = xEnd * scope.horizontalPixelRatio;
                const width = xEndPx - xStartPx;

                const color = zone.color;
                const alpha = zone.active ? 0.2 : 0.08;

                ctx.fillStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
                ctx.fillRect(xStartPx, yTop, width, height);

                ctx.strokeStyle = color;
                ctx.lineWidth = zone.active ? 2 : 1;
                
                if (!zone.active) {
                    ctx.setLineDash([5, 5]);
                }

                ctx.beginPath();
                ctx.moveTo(xStartPx, yTop);
                ctx.lineTo(xEndPx, yTop);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(xStartPx, yBottom);
                ctx.lineTo(xEndPx, yBottom);
                ctx.stroke();

                ctx.setLineDash([]);

                if (zone.active && zone.label) {
                    ctx.font = '11px sans-serif';
                    const textWidth = ctx.measureText(zone.label).width;
                    const padding = 8;
                    
                    const labelX = Math.min(xEndPx - textWidth - padding * 2, scope.bitmapSize.width - textWidth - padding * 2);
                    const labelY = yTop + height / 2 - 8;

                    ctx.fillStyle = 'rgba(19, 23, 34, 0.9)';
                    ctx.fillRect(labelX, labelY, textWidth + padding, 16);

                    ctx.fillStyle = color;
                    ctx.fillText(zone.label, labelX + padding / 2, labelY + 12);
                }
            }
        });
    }
}

class ZonesPrimitivePaneView {
    constructor(zones, chart, series, latestTime) {
        this._zones = zones;
        this._chart = chart;
        this._series = series;
        this._latestTime = latestTime;
    }

    update(zones, latestTime) {
        this._zones = zones;
        this._latestTime = latestTime;
    }

    renderer() {
        return new ZonesPaneRenderer(this._zones, this._chart, this._series, this._latestTime);
    }
}

class ZonesPrimitive {
    constructor(chart, series, zonesRef, latestTimeRef) {
        this._chart = chart;
        this._series = series;
        this._zonesRef = zonesRef;
        this._latestTimeRef = latestTimeRef;
        this._paneViews = [new ZonesPrimitivePaneView([], chart, series, null)];
    }

    updateAllViews() {
        const zones = this._zonesRef();
        const latestTime = this._latestTimeRef();
        
        if (!zones || zones.size === 0) {
            this._paneViews[0].update([], latestTime);
            return;
        }

        const drawableZones = [];
        
        for (const zone of zones.values()) {
            drawableZones.push({
                id: zone.id,
                high: zone.high,
                low: zone.low,
                start_time: zone.start_time,
                end_time: zone.end_time,
                color: zone.zone_type === 'support' ? '#26a69a' : '#ef5350',
                active: zone.active,
                label: zone.active ? `${zone.zone_type.toUpperCase()} (${zone.interactions}) [${zone.score.toFixed(2)}]` : null
            });
        }

        this._paneViews[0].update(drawableZones, latestTime);
    }

    paneViews() {
        return this._paneViews;
    }
}

// ===== MAIN TRADING CHART CLASS =====
class TradingChart {
    constructor() {
        this.ws = null;
        this.chart = null;
        this.candleSeries = null;
        this.volumeSeries = null;
        this.zonesPrimitive = null;
        this.tradeLinesPrimitive = null;  // NEW
        this.markers = [];
        this.zones = new Map();
        this.tradeLines = new Map();  // NEW: Track active trades
        this.recentSignals = [];
        
        this.candleData = [];
        this.volumeData = [];
        this.earliestTime = null;
        this.latestTime = null;
        
        this.animationFrameId = null;
        
        this.init();
    }

    init() {
        this.setupChart();
        this.connectWebSocket();
        this.startContinuousUpdate();
    }

    startContinuousUpdate() {
        const updateLoop = () => {
            if (this.zones.size > 0) {
                this.updateZones();
            }
            if (this.tradeLines.size > 0) {
                this.updateTradeLines();  // NEW
            }
            this.animationFrameId = requestAnimationFrame(updateLoop);
        };
        
        updateLoop();
    }

    setupChart() {
        const chartContainer = document.getElementById('chart');
        
        this.chart = LightweightCharts.createChart(chartContainer, {
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
            layout: {
                background: { color: '#131722' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: '#1e222d' },
                horzLines: { color: '#1e222d' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: '#2a2e39',
            },
            timeScale: {
                borderColor: '#2a2e39',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        this.candleSeries = this.chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        this.setupZonesPrimitive();
        this.setupTradeLinesPrimitive();  // NEW

        this.volumeSeries = this.chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '',
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        window.addEventListener('resize', () => {
            this.chart.applyOptions({
                width: chartContainer.clientWidth,
                height: chartContainer.clientHeight,
            });
        });
        
        this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
            this.updateZones();
            this.updateTradeLines();  // NEW
        });
    }

    setupZonesPrimitive() {
        const zonesRef = () => this.zones;
        const latestTimeRef = () => this.latestTime;
        this.zonesPrimitive = new ZonesPrimitive(this.chart, this.candleSeries, zonesRef, latestTimeRef);
        this.candleSeries.attachPrimitive(this.zonesPrimitive);
    }

    setupTradeLinesPrimitive() {
        const tradeLinesRef = () => this.tradeLines;
        this.tradeLinesPrimitive = new TradeLinesPrimitive(this.chart, this.candleSeries, tradeLinesRef);
        this.candleSeries.attachPrimitive(this.tradeLinesPrimitive);
    }

    updateZones() {
        if (this.zonesPrimitive) {
            this.zonesPrimitive.updateAllViews();
        }
    }

    updateTradeLines() {
        if (this.tradeLinesPrimitive) {
            this.tradeLinesPrimitive.updateAllViews();
        }
    }

    connectWebSocket() {
        const wsUrl = 'wss://trading-backend-s3cy.onrender.com/ws';
        console.log('Connecting to WebSocket:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus(true);
            document.getElementById('loading').style.display = 'none';
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus(false);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus(false);
            setTimeout(() => {
                console.log('Attempting to reconnect...');
                this.connectWebSocket();
            }, 3000);
        };
    }

    updateConnectionStatus(connected) {
        const indicator = document.getElementById('statusIndicator');
        const text = document.getElementById('statusText');
        
        if (connected) {
            indicator.classList.add('connected');
            text.textContent = 'Connected';
        } else {
            indicator.classList.remove('connected');
            text.textContent = 'Disconnected';
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'candle':
                this.handleCandle(message);
                break;
            case 'fractal':
                this.handleFractal(message);
                break;
            case 'zone':
                this.handleZone(message);
                break;
            case 'signal':
                this.handleSignal(message);
                break;
            case 'indicator':
                this.handleIndicator(message);
                break;
            case 'interaction':
                this.handleInteraction(message);
                break;
            case 'metrics':
                this.handleMetrics(message);
                break;
            case 'trade_lines':
                this.handleTradeLines(message);
                break;
            case 'trim_data':
                this.handleTrimData(message);
                break;
        }
    }
    

    handleTradeLines(message) {
        const action = message.action;
        const data = message.data;
        
        if (action === 'add') {
            console.log(`Ã°Å¸â€œÅ  [Trade Lines] Adding SL/TP for order ${data.order_id}`);
            this.tradeLines.set(data.order_id, {
                order_id: data.order_id,
                order_type: data.order_type,
                entry_price: data.entry_price,
                stop_loss: data.stop_loss,
                take_profit: data.take_profit
            });
            this.updateTradeLines();
            
        } else if (action === 'update_tp') {
            const trade = this.tradeLines.get(data.order_id);
            if (trade) {
                console.log(`Ã°Å¸â€â€ž [Trade Lines] Updating TP for order ${data.order_id}: ${trade.take_profit.toFixed(2)} -> ${data.take_profit.toFixed(2)}`);
                trade.take_profit = data.take_profit;
                this.updateTradeLines();
            }
            
        } else if (action === 'remove') {
            console.log(`Ã¢ÂÅ’ [Trade Lines] Removing lines for order ${data.order_id}`);
            this.tradeLines.delete(data.order_id);
            this.updateTradeLines();
        }
    }

    handleTrimData(message) {
        const windowStartTime = message.data.window_start_time;
        const windowEndTime = message.data.window_end_time;
        
        console.log(`🗑️ Trimming data: keeping candles from ${windowStartTime} to ${windowEndTime}`);
        
        // 1. Trim candle data
        const oldCandleCount = this.candleData.length;
        this.candleData = this.candleData.filter(c => c.time >= windowStartTime);
        
        // 2. Trim volume data
        this.volumeData = this.volumeData.filter(v => v.time >= windowStartTime);
        
        // 3. Update earliest time
        if (this.candleData.length > 0) {
            this.earliestTime = this.candleData[0].time;
        }
        
        // 4. Reset chart data (LightweightCharts will handle the cleanup)
        this.candleSeries.setData(this.candleData);
        this.volumeSeries.setData(this.volumeData);
        
        // 5. Trim markers (fractals, signals, interactions)
        const oldMarkerCount = this.markers.length;
        this.markers = this.markers.filter(m => m.time >= windowStartTime);
        this.candleSeries.setMarkers(this.markers);
        
        // 6. Trim signals sidebar
        const oldSignalCount = this.recentSignals.length;
        this.recentSignals = this.recentSignals.filter(s => s.time >= windowStartTime);
        this.updateSignalsSidebar();
        
        console.log(`✅ Trim complete: Candles ${oldCandleCount}→${this.candleData.length}, ` +
                    `Markers ${oldMarkerCount}→${this.markers.length}, ` +
                    `Signals ${oldSignalCount}→${this.recentSignals.length}`);
    }

    handleCandle(message) {

        const candle = {
            time: message.data.time,
            open: message.data.open,
            high: message.data.high,
            low: message.data.low,
            close: message.data.close,
        };

        const volume = {
            time: message.data.time,
            value: message.data.volume,
            color: message.data.close >= message.data.open ? '#26a69a80' : '#ef535080',
        };

        this.candleData.push(candle);
        this.volumeData.push(volume);
        
        if (this.earliestTime === null || candle.time < this.earliestTime) {
            this.earliestTime = candle.time;
        }
        if (this.latestTime === null || candle.time > this.latestTime) {
            this.latestTime = candle.time;
        }

        this.candleSeries.update(candle);
        this.volumeSeries.update(volume);
        
        this.updateZones();
        this.updateTradeLines();  // NEW
    }

    handleFractal(message) {
        const exists = this.markers.some(m => 
            m.time === message.data.time && 
            m.shape === (message.data.fractal_type === 'high' ? 'arrowDown' : 'arrowUp')
        );
        
        if (exists) {
            return;
        }
    
        // Color based on priority
        let color;
        switch(message.data.priority) {
            case 0:
                color = '#00bcd4';  // Cyan
                break;
            case 1:
                color = '#2196f3';  // Blue
                break;
            case 2:
                color = '#9c27b0';  // Purple
                break;
            default:
                color = message.data.fractal_type === 'high' ? '#ef5350' : '#26a69a';
        }
    
        const marker = {
            time: message.data.time,
            position: message.data.fractal_type === 'high' ? 'aboveBar' : 'belowBar',
            color: color,  // Use priority-based color
            shape: message.data.fractal_type === 'high' ? 'arrowDown' : 'arrowUp',
            size: message.data.priority === 0 ? 2 : 0.8,
        };
    
        this.markers.push(marker);
        this.candleSeries.setMarkers(this.markers);
    }

    handleZone(message) {
        const action = message.action;
        const data = message.data;
        
        if (action === 'add') {
            const zoneData = {
                id: data.id,
                zone_type: data.zone_type,
                low: data.low,
                high: data.high,
                start_time: data.start_time,
                end_time: data.end_time,
                active: data.active,
                interactions: data.interactions,
                score: data.score,
                flipped: data.flipped
            };
            
            this.zones.set(data.id, zoneData);
            this.updateZones();
            this.updateZonesSidebar();
            
        } else if (action === 'update') {
            const existing = this.zones.get(data.id);
            if (existing) {
                existing.zone_type = data.zone_type;
                existing.low = data.low;
                existing.high = data.high;
                existing.active = data.active;
                existing.interactions = data.interactions;
                existing.score = data.score;
                existing.flipped = data.flipped;
                existing.end_time = data.end_time;
                
                this.updateZones();
                this.updateZonesSidebar();
            }
            
        } else if (action === 'remove') {
            if (this.zones.has(data.id)) {
                this.zones.delete(data.id);
                this.updateZones();
                this.updateZonesSidebar();
            }
        }
    }

    handleSignal(message) {
        const signalKey = `${message.data.time}-${message.data.signal_type}`;
        const exists = this.recentSignals.some(s => s.key === signalKey);
        
        if (exists) {
            return;
        }

        const originalType = message.data.signal_type;
        // Construct the full label text for display
        const markerText = message.data.order_id 
            ? `${originalType} (ID:${message.data.order_id})` 
            : originalType;
            
        const marker = {
            time: message.data.time,
            position: originalType.includes('LONG') || originalType === 'R_L' ? 'belowBar' : 'aboveBar',
            color: originalType.includes('LONG') || originalType === 'R_L' ? '#26a69a' : '#ef5350',
            shape: originalType.includes('LONG') || originalType === 'R_L' ? 'arrowUp' : 'arrowDown',
            text: markerText, // Used for the chart marker pop-up
            size: 2,
        };
        
        this.markers.push(marker);
        this.candleSeries.setMarkers(this.markers);
        
        // Store both original type and full label for the sidebar list
        this.recentSignals.unshift({
            key: signalKey,
            originalType: originalType, // Used for CSS class (e.g., "LONG")
            labelText: markerText,     // Used for display text (e.g., "LONG (ID:15)")
            price: message.data.price,
            time: message.data.time,
        });
        
        // Keep the list manageable
        if (this.recentSignals.length > 50) {
            this.recentSignals.pop();
        }
        
        this.updateSignalsSidebar();
    }

    handleIndicator(message) {
        // Not displayed
    }

    handleInteraction(message) {
        const marker = {
            time: message.data.time,
            position: 'inBar',
            color: message.data.zone_type === 'support' ? '#26a69a' : '#ef5350',
            shape: 'circle',
            size: 0.5,
        };

        this.markers.push(marker);
        this.candleSeries.setMarkers(this.markers);
    }

    handleMetrics(message) {
        document.getElementById('totalTrades').textContent = message.data.total_trades || 0;
        document.getElementById('winRate').textContent = `${(message.data.win_rate || 0).toFixed(1)}%`;
        
        const pnl = message.data.total_pnl || 0;
        const pnlElement = document.getElementById('totalPnL');
        pnlElement.textContent = `$${pnl.toFixed(2)}`;
        pnlElement.className = 'metric-value ' + (pnl >= 0 ? 'positive' : 'negative');
        
        const roi = message.data.roi || 0;
        const roiElement = document.getElementById('roi');
        roiElement.textContent = `${roi.toFixed(2)}%`;
        roiElement.className = 'metric-value ' + (roi >= 0 ? 'positive' : 'negative');
    }

    updateZonesSidebar() {
        const container = document.getElementById('zonesList');
        
        const allZones = Array.from(this.zones.values());
        
        if (allZones.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #787b86; padding: 20px;">No zones</div>';
            return;
        }

        const activeZones = allZones.filter(z => z.active);
        const inactiveZones = allZones.filter(z => !z.active);
        
        activeZones.sort((a, b) => b.score - a.score);
        inactiveZones.sort((a, b) => b.score - a.score);

        let html = '';
        
        if (activeZones.length > 0) {
            html += '<div style="color: #26a69a; font-weight: bold; margin-bottom: 8px;">Active Zones</div>';
            html += activeZones.map(zone => `
                <div class="zone-item ${zone.zone_type}">
                    <div class="zone-header">
                        <span class="zone-type ${zone.zone_type}">${zone.zone_type}</span>
                        <span class="zone-score">Score: ${zone.score.toFixed(2)}</span>
                    </div>
                    <div class="zone-price">${zone.low.toFixed(2)} - ${zone.high.toFixed(2)}</div>
                    <div class="zone-interactions">Interactions: ${zone.interactions}</div>
                </div>
            `).join('');
        }
        
        if (inactiveZones.length > 0) {
            html += '<div style="color: #787b86; font-weight: bold; margin: 16px 0 8px 0;">Inactive Zones</div>';
            html += inactiveZones.map(zone => `
                <div class="zone-item ${zone.zone_type}" style="opacity: 0.5;">
                    <div class="zone-header">
                        <span class="zone-type ${zone.zone_type}">${zone.zone_type}</span>
                        <span class="zone-score">Score: ${zone.score.toFixed(2)}</span>
                    </div>
                    <div class="zone-price">${zone.low.toFixed(2)} - ${zone.high.toFixed(2)}</div>
                    <div class="zone-interactions">Interactions: ${zone.interactions}</div>
                </div>
            `).join('');
        }
        
        container.innerHTML = html;
    }

    updateSignalsSidebar() {
        const container = document.getElementById('signalsList');
        
        if (this.recentSignals.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #787b86; padding: 20px;">No signals yet</div>';
            return;
        }

        container.innerHTML = this.recentSignals.map(signal => {
            const date = new Date(signal.time * 1000);
            const timeStr = date.toLocaleTimeString();
            
            return `
                <div class="signal-item">
                    <span class="signal-type ${signal.originalType}">${signal.labelText}</span>
                    <div>
                        <div class="signal-price">${signal.price.toFixed(2)}</div>
                        <div class="signal-price">${timeStr}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TradingChart();
});