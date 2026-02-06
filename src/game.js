/**
 * 春节模拟器 - 游戏核心逻辑
 * Spring Festival Simulator - Game Core Logic
 * 
 * 架构设计：
 * - GameState: 游戏状态管理
 * - AttributeManager: 属性管理器
 * - EventManager: 事件管理器
 * - SaveManager: 存档管理器
 * - EndingManager: 结局管理器
 * - Game: 游戏主控制器
 */

// ============================================
// 常量定义
// ============================================

const GAME_CONFIG = {
    VERSION: '1.0.0',
    TOTAL_DAYS: 9,
    PERIODS_PER_DAY: 3,
    PERIOD_NAMES: ['早晨', '中午', '晚上'],
    DAY_NAMES: [
        '腊月二十九', '除夕', '大年初一', '大年初二', '大年初三',
        '大年初四', '大年初五', '大年初六', '大年初七'
    ],
    SAVE_SLOTS: 5,
    AUTO_SAVE_INTERVAL: 60000 // 60秒自动存档
};

const ATTRIBUTE_BOUNDS = {
    deposit: { min: -50000, max: 10000000, default: 0 },
    weight: { min: 30, max: 200, default: 65 },
    face: { min: -100, max: 100, default: 50 },
    mood: { min: 0, max: 100, default: 50 },
    health: { min: 0, max: 100, default: 50 },
    luck: { min: 0, max: 100, default: 50 }
};

const ATTRIBUTE_NAMES = {
    deposit: '存款',
    weight: '体重',
    face: '面子',
    mood: '心情',
    health: '健康',
    luck: '运气'
};

const ATTRIBUTE_ICONS = {
    deposit: '💰',
    weight: '⚖️',
    face: '👑',
    mood: '😊',
    health: '❤️',
    luck: '🍀'
};

// ============================================
// GameState - 游戏状态管理器
// ============================================

class GameState {
    constructor() {
        this.reset();
    }

    /**
     * 重置游戏状态
     */
    reset() {
        this.meta = {
            version: GAME_CONFIG.VERSION,
            startTime: null,
            lastSaveTime: null,
            playCount: 0
        };

        this.progress = {
            currentDay: 1,
            currentPeriod: 0,
            totalPeriods: 0
        };

        this.character = null;
        this.attributes = {};
        this.inventory = {};
        this.eventHistory = [];
        this.flags = {};
        this.pendingEvents = [];
        this.triggeredOnceEvents = [];
        this.statistics = {
            totalEvents: 0,
            totalChoices: 0,
            moneySpent: 0,
            moneyEarned: 0,
            redEnvelopesGiven: 0,
            redEnvelopesReceived: 0,
            mealsEaten: 0,
            relativesMet: 0
        };

        this.currentEvent = null;
        this.currentScreen = 'start';
    }

    /**
     * 初始化新游戏
     * @param {Object} character - 选择的角色
     */
    initNewGame(character) {
        this.reset();
        this.meta.startTime = Date.now();
        this.character = character;
        
        // 初始化属性
        if (character && character.initial_attributes) {
            this.attributes = { ...character.initial_attributes };
        } else {
            // 默认属性
            this.attributes = {
                deposit: 5000,
                weight: 65,
                face: 50,
                mood: 70,
                health: 80,
                luck: 50
            };
        }

        // 确保属性在有效范围内
        this.clampAllAttributes();
    }

    /**
     * 推进时间
     * @returns {boolean} 是否进入新的一天
     */
    advanceTime() {
        this.progress.currentPeriod++;
        this.progress.totalPeriods++;

        if (this.progress.currentPeriod >= GAME_CONFIG.PERIODS_PER_DAY) {
            this.progress.currentPeriod = 0;
            this.progress.currentDay++;
            return true; // 新的一天
        }
        return false;
    }

    /**
     * 检查游戏是否结束
     * @returns {boolean}
     */
    isGameOver() {
        return this.progress.currentDay > GAME_CONFIG.TOTAL_DAYS ||
               (this.progress.currentDay === GAME_CONFIG.TOTAL_DAYS && 
                this.progress.currentPeriod >= GAME_CONFIG.PERIODS_PER_DAY);
    }

    /**
     * 获取当前时间描述
     * @returns {string}
     */
    getCurrentTimeDesc() {
        const dayName = GAME_CONFIG.DAY_NAMES[this.progress.currentDay - 1] || `第${this.progress.currentDay}天`;
        const periodName = GAME_CONFIG.PERIOD_NAMES[this.progress.currentPeriod];
        return `${dayName} ${periodName}`;
    }

    /**
     * 记录事件
     * @param {string} eventId - 事件ID
     * @param {number} choiceIndex - 选择索引
     * @param {string} choiceId - 选择ID
     */
    recordEvent(eventId, choiceIndex, choiceId) {
        this.eventHistory.push({
            eventId,
            day: this.progress.currentDay,
            period: this.progress.currentPeriod,
            choiceIndex,
            choiceId,
            timestamp: Date.now()
        });
        this.statistics.totalEvents++;
        this.statistics.totalChoices++;
    }

    /**
     * 设置标记
     * @param {string} name - 标记名
     * @param {*} value - 标记值
     */
    setFlag(name, value) {
        this.flags[name] = value;
    }

    /**
     * 获取标记
     * @param {string} name - 标记名
     * @param {*} defaultValue - 默认值
     * @returns {*}
     */
    getFlag(name, defaultValue = null) {
        return this.flags[name] !== undefined ? this.flags[name] : defaultValue;
    }

    /**
     * 检查标记
     * @param {string} name - 标记名
     * @returns {boolean}
     */
    hasFlag(name) {
        return this.flags[name] !== undefined;
    }

    /**
     * 添加待触发事件
     * @param {string} eventId - 事件ID
     * @param {Object} options - 选项
     */
    addPendingEvent(eventId, options = {}) {
        this.pendingEvents.push({
            eventId,
            triggerDay: options.triggerDay,
            triggerPeriod: options.triggerPeriod,
            priority: options.priority || 0
        });
    }

    /**
     * 标记一次性事件已触发
     * @param {string} eventId - 事件ID
     */
    markEventTriggered(eventId) {
        if (!this.triggeredOnceEvents.includes(eventId)) {
            this.triggeredOnceEvents.push(eventId);
        }
    }

    /**
     * 检查事件是否已触发
     * @param {string} eventId - 事件ID
     * @returns {boolean}
     */
    isEventTriggered(eventId) {
        return this.triggeredOnceEvents.includes(eventId);
    }

    /**
     * 限制属性在有效范围内
     */
    clampAllAttributes() {
        for (const [attr, bounds] of Object.entries(ATTRIBUTE_BOUNDS)) {
            if (this.attributes[attr] !== undefined) {
                this.attributes[attr] = Math.max(
                    bounds.min,
                    Math.min(bounds.max, this.attributes[attr])
                );
            }
        }
    }

    /**
     * 序列化游戏状态
     * @returns {Object}
     */
    serialize() {
        return {
            meta: { ...this.meta },
            progress: { ...this.progress },
            character: this.character,
            attributes: { ...this.attributes },
            inventory: { ...this.inventory },
            eventHistory: [...this.eventHistory],
            flags: { ...this.flags },
            pendingEvents: [...this.pendingEvents],
            triggeredOnceEvents: [...this.triggeredOnceEvents],
            statistics: { ...this.statistics }
        };
    }

    /**
     * 反序列化游戏状态
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        this.meta = data.meta || this.meta;
        this.progress = data.progress || this.progress;
        this.character = data.character;
        this.attributes = data.attributes || {};
        this.inventory = data.inventory || {};
        this.eventHistory = data.eventHistory || [];
        this.flags = data.flags || {};
        this.pendingEvents = data.pendingEvents || [];
        this.triggeredOnceEvents = data.triggeredOnceEvents || [];
        this.statistics = data.statistics || {};
    }
}

// ============================================
// AttributeManager - 属性管理器
// ============================================

class AttributeManager {
    constructor(gameState) {
        this.gameState = gameState;
    }

    /**
     * 获取属性值
     * @param {string} attribute - 属性名
     * @returns {number}
     */
    get(attribute) {
        return this.gameState.attributes[attribute] || 0;
    }

    /**
     * 设置属性值
     * @param {string} attribute - 属性名
     * @param {number} value - 属性值
     */
    set(attribute, value) {
        const bounds = ATTRIBUTE_BOUNDS[attribute];
        if (bounds) {
            value = Math.max(bounds.min, Math.min(bounds.max, value));
        }
        this.gameState.attributes[attribute] = value;
    }

    /**
     * 修改属性值
     * @param {string} attribute - 属性名
     * @param {number} delta - 变化量
     * @param {string} operation - 操作类型: 'add' | 'set' | 'multiply'
     */
    modify(attribute, delta, operation = 'add') {
        let currentValue = this.get(attribute);
        let newValue;

        switch (operation) {
            case 'add':
                newValue = currentValue + delta;
                break;
            case 'set':
                newValue = delta;
                break;
            case 'multiply':
                newValue = currentValue * delta;
                break;
            default:
                newValue = currentValue + delta;
        }

        this.set(attribute, newValue);

        // 统计金钱变化
        if (attribute === 'deposit') {
            if (delta < 0) {
                this.gameState.statistics.moneySpent += Math.abs(delta);
            } else if (delta > 0) {
                this.gameState.statistics.moneyEarned += delta;
            }
        }

        return this.get(attribute);
    }

    /**
     * 批量修改属性
     * @param {Array} effects - 效果数组
     */
    applyEffects(effects) {
        if (!Array.isArray(effects)) return;

        const results = [];
        for (const effect of effects) {
            if (effect.type === 'attribute' || effect.attribute) {
                const attr = effect.attribute;
                let value = effect.value;

                // 处理随机值
                if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
                    value = Math.floor(Math.random() * (value.max - value.min + 1)) + value.min;
                }

                // 检查条件
                if (effect.condition && !this.checkCondition(effect.condition)) {
                    continue;
                }

                const operation = effect.operation || 'add';
                const oldValue = this.get(attr);
                this.modify(attr, value, operation);
                const newValue = this.get(attr);

                results.push({
                    attribute: attr,
                    oldValue,
                    newValue,
                    change: newValue - oldValue
                });
            }
        }

        return results;
    }

    /**
     * 检查条件
     * @param {Object} condition - 条件对象
     * @returns {boolean}
     */
    checkCondition(condition) {
        if (!condition) return true;

        const { type, params } = condition;

        switch (type) {
            case 'attribute':
                const value = this.get(params.attribute);
                const targetValue = params.value;
                switch (params.operator) {
                    case '>': return value > targetValue;
                    case '<': return value < targetValue;
                    case '>=': return value >= targetValue;
                    case '<=': return value <= targetValue;
                    case '==': return value === targetValue;
                    case '!=': return value !== targetValue;
                    default: return value >= targetValue;
                }
            case 'flag':
                return this.gameState.getFlag(params.flagName) === params.flagValue;
            case 'random':
                return Math.random() < params.probability;
            default:
                return true;
        }
    }

    /**
     * 获取所有属性
     * @returns {Object}
     */
    getAll() {
        return { ...this.gameState.attributes };
    }

    /**
     * 获取属性百分比（用于进度条）
     * @param {string} attribute - 属性名
     * @returns {number}
     */
    getPercentage(attribute) {
        const value = this.get(attribute);
        const bounds = ATTRIBUTE_BOUNDS[attribute];
        if (!bounds) return 50;

        // 对于存款，使用对数刻度
        if (attribute === 'deposit') {
            const minLog = Math.log10(Math.max(1, Math.abs(bounds.min)));
            const maxLog = Math.log10(Math.max(1, bounds.max));
            const valueLog = Math.log10(Math.max(1, Math.abs(value)));
            const percentage = ((valueLog - minLog) / (maxLog - minLog)) * 100;
            return Math.max(0, Math.min(100, percentage));
        }

        return ((value - bounds.min) / (bounds.max - bounds.min)) * 100;
    }

    /**
     * 计算平均属性值
     * @param {Array} attributes - 属性名数组
     * @returns {number}
     */
    getAverage(attributes = ['face', 'mood', 'health']) {
        const sum = attributes.reduce((acc, attr) => acc + this.get(attr), 0);
        return sum / attributes.length;
    }
}

// ============================================
// EventManager - 事件管理器
// ============================================

class EventManager {
    constructor(gameState, attributeManager) {
        this.gameState = gameState;
        this.attributeManager = attributeManager;
        this.events = [];
        this.eventMap = new Map();
    }

    /**
     * 加载事件数据
     * @param {Array} events - 事件数组
     */
    loadEvents(events) {
        this.events = events || [];
        this.eventMap.clear();
        
        for (const event of this.events) {
            this.eventMap.set(event.id, event);
        }
    }

    /**
     * 获取事件
     * @param {string} eventId - 事件ID
     * @returns {Object|null}
     */
    getEvent(eventId) {
        return this.eventMap.get(eventId) || null;
    }

    /**
     * 获取下一个事件
     * @returns {Object|null}
     */
    getNextEvent() {
        const { currentDay, currentPeriod } = this.gameState.progress;

        // 1. 检查待触发事件队列
        const pendingEvent = this.getPendingEvent();
        if (pendingEvent) {
            return pendingEvent;
        }

        // 2. 获取所有可用事件
        const availableEvents = this.events.filter(event => 
            this.isEventAvailable(event, currentDay, currentPeriod)
        );

        if (availableEvents.length === 0) {
            return this.getDefaultEvent();
        }

        // 3. 按权重随机选择
        const totalWeight = availableEvents.reduce((sum, e) => sum + (e.weight || 100), 0);
        let random = Math.random() * totalWeight;

        for (const event of availableEvents) {
            random -= (event.weight || 100);
            if (random <= 0) {
                return event;
            }
        }

        return availableEvents[0];
    }

    /**
     * 检查事件是否可用
     * @param {Object} event - 事件对象
     * @param {number} day - 当前天数
     * @param {number} period - 当前时段
     * @returns {boolean}
     */
    isEventAvailable(event, day, period) {
        // 检查是否已触发（一次性事件）
        if (event.onceOnly && this.gameState.isEventTriggered(event.id)) {
            return false;
        }

        // 检查触发条件
        if (event.triggerConditions) {
            for (const condition of event.triggerConditions) {
                if (!this.checkTriggerCondition(condition, day, period)) {
                    return false;
                }
            }
        }

        // 检查互斥事件
        if (event.mutuallyExclusive) {
            for (const mutexId of event.mutuallyExclusive) {
                if (this.gameState.isEventTriggered(mutexId)) {
                    return false;
                }
            }
        }

        // 检查前置事件
        if (event.prerequisiteEvents) {
            for (const preId of event.prerequisiteEvents) {
                if (!this.gameState.isEventTriggered(preId)) {
                    return false;
                }
            }
        }

        // 检查角色专属
        if (event.exclusiveTo && this.gameState.character) {
            if (!event.exclusiveTo.includes(this.gameState.character.id)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 检查触发条件
     * @param {Object} condition - 条件对象
     * @param {number} day - 当前天数
     * @param {number} period - 当前时段
     * @returns {boolean}
     */
    checkTriggerCondition(condition, day, period) {
        const { type, params } = condition;

        switch (type) {
            case 'time':
                if (params.days && !params.days.includes(day)) return false;
                if (params.periods && !params.periods.includes(period)) return false;
                if (params.dayRange) {
                    if (day < params.dayRange.min || day > params.dayRange.max) return false;
                }
                return true;

            case 'attribute':
                const value = this.attributeManager.get(params.attribute);
                const targetValue = params.value;
                switch (params.operator) {
                    case '>': return value > targetValue;
                    case '<': return value < targetValue;
                    case '>=': return value >= targetValue;
                    case '<=': return value <= targetValue;
                    case '==': return value === targetValue;
                    case '!=': return value !== targetValue;
                    default: return value >= targetValue;
                }

            case 'probability':
                let probability = params.baseRate;
                if (params.luckModifier) {
                    const luck = this.attributeManager.get('luck');
                    probability += (luck - 50) / 500; // 运气影响概率
                }
                return Math.random() < probability;

            case 'event_history':
                const triggered = this.gameState.isEventTriggered(params.eventId);
                return params.triggered === triggered;

            case 'character':
                return params.characterIds.includes(this.gameState.character?.id);

            default:
                return true;
        }
    }

    /**
     * 获取待触发事件
     * @returns {Object|null}
     */
    getPendingEvent() {
        const { currentDay, currentPeriod } = this.gameState.progress;

        // 按优先级排序
        const sortedPending = this.gameState.pendingEvents
            .filter(p => {
                if (p.triggerDay && p.triggerDay !== currentDay) return false;
                if (p.triggerPeriod !== undefined && p.triggerPeriod !== currentPeriod) return false;
                return true;
            })
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

        if (sortedPending.length > 0) {
            const pending = sortedPending[0];
            // 从队列中移除
            this.gameState.pendingEvents = this.gameState.pendingEvents.filter(
                p => p !== pending
            );
            return this.getEvent(pending.eventId);
        }

        return null;
    }

    /**
     * 获取默认事件
     * @returns {Object}
     */
    getDefaultEvent() {
        return {
            id: 'default_event',
            title: '平静的时光',
            description: '没有什么特别的事情发生，你享受了一段平静的时光。',
            category: 'random',
            scene: '🏠',
            location: '家中',
            npc: '👤',
            npcName: '自己',
            weight: 100,
            onceOnly: false,
            options: [
                {
                    id: 'relax',
                    text: '好好休息',
                    effects: [{ type: 'attribute', attribute: 'mood', value: 5 }]
                },
                {
                    id: 'exercise',
                    text: '做些运动',
                    effects: [
                        { type: 'attribute', attribute: 'health', value: 3 },
                        { type: 'attribute', attribute: 'weight', value: -0.5 }
                    ]
                },
                {
                    id: 'snack',
                    text: '吃点零食',
                    effects: [
                        { type: 'attribute', attribute: 'mood', value: 3 },
                        { type: 'attribute', attribute: 'weight', value: 0.5 }
                    ]
                }
            ]
        };
    }

    /**
     * 处理选项选择
     * @param {Object} event - 当前事件
     * @param {number} choiceIndex - 选择索引
     * @returns {Object} 处理结果
     */
    processChoice(event, choiceIndex) {
        const choice = event.options[choiceIndex];
        if (!choice) return null;

        // 应用效果
        const effectResults = this.attributeManager.applyEffects(choice.effects);

        // 记录事件
        this.gameState.recordEvent(event.id, choiceIndex, choice.id);

        // 标记一次性事件
        if (event.onceOnly) {
            this.gameState.markEventTriggered(event.id);
        }

        // 处理后续事件
        if (choice.followUpEvents) {
            for (const followUp of choice.followUpEvents) {
                const delay = followUp.delay || 'next_period';
                let triggerDay = this.gameState.progress.currentDay;
                let triggerPeriod = this.gameState.progress.currentPeriod;

                switch (delay) {
                    case 'immediate':
                        // 立即触发，不加入队列
                        continue;
                    case 'next_period':
                        triggerPeriod++;
                        if (triggerPeriod >= GAME_CONFIG.PERIODS_PER_DAY) {
                            triggerPeriod = 0;
                            triggerDay++;
                        }
                        break;
                    case 'next_day':
                        triggerDay++;
                        triggerPeriod = 0;
                        break;
                }

                // 概率检查
                if (followUp.probability && Math.random() > followUp.probability) {
                    continue;
                }

                this.gameState.addPendingEvent(followUp.eventId, {
                    triggerDay,
                    triggerPeriod,
                    priority: followUp.priority || 0
                });
            }
        }

        // 处理特殊结果
        let specialOutcome = null;
        if (choice.specialOutcome) {
            specialOutcome = choice.specialOutcome;
        }

        return {
            choice,
            effectResults,
            specialOutcome,
            feedback: choice.feedback
        };
    }

    /**
     * 获取可用的选项
     * @param {Object} event - 事件对象
     * @returns {Array}
     */
    getAvailableOptions(event) {
        if (!event.options) return [];

        return event.options.map((option, index) => {
            let available = true;
            let unavailableReason = '';

            // 检查可用条件
            if (option.availabilityConditions) {
                for (const condition of option.availabilityConditions) {
                    if (!this.attributeManager.checkCondition(condition)) {
                        available = false;
                        unavailableReason = option.unavailableText || '条件不满足';
                        break;
                    }
                }
            }

            // 检查可见条件
            let visible = true;
            if (option.visibilityConditions) {
                for (const condition of option.visibilityConditions) {
                    if (!this.attributeManager.checkCondition(condition)) {
                        visible = false;
                        break;
                    }
                }
            }

            return {
                ...option,
                index,
                available,
                visible,
                unavailableReason
            };
        }).filter(opt => opt.visible);
    }
}

// ============================================
// SaveManager - 存档管理器
// ============================================

class SaveManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.storageKey = 'springFestivalSaves_v1';
        this.settingsKey = 'springFestivalSettings_v1';
        this.maxSlots = GAME_CONFIG.SAVE_SLOTS;
        this.saves = [];
        this.autoSaveTimer = null;
    }

    /**
     * 初始化存档管理器
     */
    init() {
        this.loadSavesFromStorage();
        this.startAutoSave();
    }

    /**
     * 从存储加载存档
     */
    loadSavesFromStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                this.saves = JSON.parse(data);
            } else {
                this.saves = new Array(this.maxSlots).fill(null);
            }
        } catch (e) {
            console.error('加载存档失败:', e);
            this.saves = new Array(this.maxSlots).fill(null);
        }
    }

    /**
     * 保存到存储
     */
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.saves));
            return true;
        } catch (e) {
            console.error('保存存档失败:', e);
            return false;
        }
    }

    /**
     * 创建存档
     * @param {number} slotIndex - 存档槽索引
     * @param {string} name - 存档名称
     * @returns {boolean}
     */
    createSave(slotIndex, name = '') {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) {
            return false;
        }

        const saveData = {
            name: name || `存档 ${slotIndex + 1}`,
            date: new Date().toISOString(),
            dateDisplay: new Date().toLocaleString('zh-CN'),
            gameState: this.gameState.serialize()
        };

        this.saves[slotIndex] = saveData;
        return this.saveToStorage();
    }

    /**
     * 加载存档
     * @param {number} slotIndex - 存档槽索引
     * @returns {boolean}
     */
    loadSave(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) {
            return false;
        }

        const save = this.saves[slotIndex];
        if (!save || !save.gameState) {
            return false;
        }

        this.gameState.deserialize(save.gameState);
        return true;
    }

    /**
     * 删除存档
     * @param {number} slotIndex - 存档槽索引
     * @returns {boolean}
     */
    deleteSave(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) {
            return false;
        }

        this.saves[slotIndex] = null;
        return this.saveToStorage();
    }

    /**
     * 获取存档信息
     * @param {number} slotIndex - 存档槽索引
     * @returns {Object|null}
     */
    getSaveInfo(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) {
            return null;
        }
        return this.saves[slotIndex];
    }

    /**
     * 获取所有存档信息
     * @returns {Array}
     */
    getAllSaves() {
        return this.saves.map((save, index) => ({
            index,
            ...save
        }));
    }

    /**
     * 查找空存档槽
     * @returns {number} 空槽索引，如果没有返回-1
     */
    findEmptySlot() {
        return this.saves.findIndex(save => save === null);
    }

    /**
     * 自动存档
     * @returns {boolean}
     */
    autoSave() {
        // 找到空槽或覆盖最早的存档
        let slotIndex = this.findEmptySlot();
        if (slotIndex === -1) {
            // 找到最早的存档
            let oldestIndex = 0;
            let oldestTime = Infinity;
            for (let i = 0; i < this.saves.length; i++) {
                if (this.saves[i] && this.saves[i].date) {
                    const time = new Date(this.saves[i].date).getTime();
                    if (time < oldestTime) {
                        oldestTime = time;
                        oldestIndex = i;
                    }
                }
            }
            slotIndex = oldestIndex;
        }

        return this.createSave(slotIndex, '自动存档');
    }

    /**
     * 开始自动存档
     */
    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        this.autoSaveTimer = setInterval(() => {
            if (this.gameState.character && this.gameState.currentScreen === 'game') {
                this.autoSave();
            }
        }, GAME_CONFIG.AUTO_SAVE_INTERVAL);
    }

    /**
     * 停止自动存档
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * 导出存档（用于分享或备份）
     * @returns {string}
     */
    exportSave() {
        return JSON.stringify(this.gameState.serialize());
    }

    /**
     * 导入存档
     * @param {string} data - 存档数据
     * @returns {boolean}
     */
    importSave(data) {
        try {
            const parsed = JSON.parse(data);
            this.gameState.deserialize(parsed);
            return true;
        } catch (e) {
            console.error('导入存档失败:', e);
            return false;
        }
    }

    /**
     * 保存设置
     * @param {Object} settings - 设置对象
     */
    saveSettings(settings) {
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify(settings));
            return true;
        } catch (e) {
            console.error('保存设置失败:', e);
            return false;
        }
    }

    /**
     * 加载设置
     * @returns {Object}
     */
    loadSettings() {
        try {
            const data = localStorage.getItem(this.settingsKey);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('加载设置失败:', e);
            return {};
        }
    }

    /**
     * 清空所有存档
     */
    clearAllSaves() {
        this.saves = new Array(this.maxSlots).fill(null);
        return this.saveToStorage();
    }
}

// ============================================
// EndingManager - 结局管理器
// ============================================

class EndingManager {
    constructor(gameState, attributeManager) {
        this.gameState = gameState;
        this.attributeManager = attributeManager;
        this.endings = [];
        this.endingMap = new Map();
    }

    /**
     * 加载结局数据
     * @param {Array} endings - 结局数组
     */
    loadEndings(endings) {
        this.endings = endings || [];
        this.endingMap.clear();

        for (const ending of this.endings) {
            this.endingMap.set(ending.id, ending);
        }
    }

    /**
     * 判定结局
     * @returns {Object}
     */
    determineEnding() {
        // 按优先级排序结局
        const currentCharacterId = this.gameState.character?.id;
        const availableEndings = currentCharacterId
            ? this.endings.filter(ending => !ending.characterId || ending.characterId === currentCharacterId)
            : this.endings;

        const sortedEndings = [...availableEndings].sort(
            (a, b) => (b.priority || 0) - (a.priority || 0)
        );

        // 检查每个结局的解锁条件
        for (const ending of sortedEndings) {
            if (this.checkEndingConditions(ending)) {
                return this.generateEndingResult(ending);
            }
        }

        // 默认结局
        return this.generateEndingResult(this.getDefaultEnding());
    }

    /**
     * 检查结局条件
     * @param {Object} ending - 结局对象
     * @returns {boolean}
     */
    checkEndingConditions(ending) {
        if (!ending.unlockConditions || ending.unlockConditions.length === 0) {
            return true;
        }

        // 满足任一条件组即可
        for (const conditionGroup of ending.unlockConditions) {
            if (this.checkConditionGroup(conditionGroup)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 检查条件组
     * @param {Object} conditionGroup - 条件组
     * @returns {boolean}
     */
    checkConditionGroup(conditionGroup) {
        if (!conditionGroup.conditions) return true;

        // 所有条件必须同时满足
        for (const condition of conditionGroup.conditions) {
            if (!this.checkEndingCondition(condition)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 检查单个结局条件
     * @param {Object} condition - 条件对象
     * @returns {boolean}
     */
    checkEndingCondition(condition) {
        const { type } = condition;

        switch (type) {
            case 'attribute':
                const value = this.attributeManager.get(condition.attribute);
                const targetValue = condition.value;
                switch (condition.operator) {
                    case '>': return value > targetValue;
                    case '<': return value < targetValue;
                    case '>=': return value >= targetValue;
                    case '<=': return value <= targetValue;
                    case '==': return value === targetValue;
                    case '!=': return value !== targetValue;
                    default: return value >= targetValue;
                }

            case 'event_triggered':
                const triggered = this.gameState.isEventTriggered(condition.eventId);
                if (condition.choiceIndex !== undefined) {
                    // 检查特定选择
                    const eventRecord = this.gameState.eventHistory.find(
                        e => e.eventId === condition.eventId && e.choiceIndex === condition.choiceIndex
                    );
                    return !!eventRecord;
                }
                return triggered;

            case 'flag_set':
                return this.gameState.getFlag(condition.flagName) === condition.flagValue;

            case 'combination':
                if (!condition.conditions) return true;
                for (const subCondition of condition.conditions) {
                    if (!this.checkEndingCondition(subCondition)) {
                        return false;
                    }
                }
                return true;

            default:
                return true;
        }
    }

    /**
     * 生成结局结果
     * @param {Object} ending - 结局对象
     * @returns {Object}
     */
    generateEndingResult(ending) {
        const score = this.calculateScore(ending);

        return {
            id: ending.id,
            title: ending.title,
            description: ending.description,
            category: ending.category,
            icon: ending.icon || this.getCategoryIcon(ending.category),
            score,
            story: this.generateStory(),
            finalStats: this.attributeManager.getAll()
        };
    }

    /**
     * 计算结局分数
     * @param {Object} ending - 结局对象
     * @returns {number}
     */
    calculateScore(ending) {
        let score = ending.score?.base || 0;

        // 应用分数修正
        if (ending.score?.modifiers) {
            for (const modifier of ending.score.modifiers) {
                if (this.checkEndingCondition(modifier.condition)) {
                    score += modifier.value;
                }
            }
        }

        // 根据属性计算额外分数
        const attrs = this.attributeManager.getAll();
        score += attrs.deposit / 1000;
        score += attrs.face / 2;
        score += attrs.mood / 2;
        score += attrs.health / 2;

        return Math.floor(score);
    }

    /**
     * 生成故事回顾
     * @returns {string}
     */
    generateStory() {
        const attrs = this.attributeManager.getAll();
        const initialAttrs = this.gameState.character?.initial_attributes || {};
        const character = this.gameState.character;

        let story = `<p>作为<strong>${character?.name || '未知角色'}</strong>，你度过了${GAME_CONFIG.TOTAL_DAYS}天的春节假期。</p>`;

        // 存款变化
        const depositChange = attrs.deposit - (initialAttrs.deposit || 0);
        if (depositChange > 10000) {
            story += `<p>你的钱包比假期前更鼓了，财运亨通！</p>`;
        } else if (depositChange > 0) {
            story += `<p>这个春节你还小赚了一笔，不错！</p>`;
        } else if (depositChange < -10000) {
            story += `<p>这个春节花了不少钱，需要好好规划一下财务了。</p>`;
        } else if (depositChange < 0) {
            story += `<p>这个春节略有开销，还在可控范围内。</p>`;
        } else {
            story += `<p>你的财务状况保持平衡。</p>`;
        }

        // 体重变化
        const weightChange = attrs.weight - (initialAttrs.weight || 65);
        if (weightChange > 3) {
            story += `<p>春节期间美食太多，你的体重增加了${weightChange.toFixed(1)}公斤。</p>`;
        } else if (weightChange < -2) {
            story += `<p>你成功控制了体重，甚至还瘦了${Math.abs(weightChange).toFixed(1)}公斤！</p>`;
        }

        // 心情
        if (attrs.mood >= 80) {
            story += `<p>这个春节你过得非常开心，留下了美好的回忆。</p>`;
        } else if (attrs.mood >= 60) {
            story += `<p>这个春节你过得还算愉快。</p>`;
        } else if (attrs.mood < 40) {
            story += `<p>这个春节让你感到有些疲惫和郁闷。</p>`;
        }

        // 健康
        if (attrs.health >= 80) {
            story += `<p>你保持了良好的健康状态，作息规律。</p>`;
        } else if (attrs.health < 50) {
            story += `<p>春节期间的应酬让你的身体有些吃不消。</p>`;
        }

        // 面子
        if (attrs.face >= 80) {
            story += `<p>你在亲戚朋友面前很有面子，备受尊重。</p>`;
        } else if (attrs.face < 30) {
            story += `<p>这个春节让你在某些场合感到有些尴尬。</p>`;
        }

        return story;
    }

    /**
     * 获取默认结局
     * @returns {Object}
     */
    getDefaultEnding() {
        return {
            id: 'ordinary_spring',
            title: '平凡春节',
            description: '一个普通的春节，有喜有忧，这就是生活的常态。',
            category: 'normal',
            icon: '🎊',
            score: { base: 500 },
            priority: 0
        };
    }

    /**
     * 获取类别图标
     * @param {string} category - 结局类别
     * @returns {string}
     */
    getCategoryIcon(category) {
        const icons = {
            perfect: '👑',
            good: '🌟',
            normal: '🎊',
            bad: '😰',
            secret: '🔮'
        };
        return icons[category] || '🎊';
    }

    /**
     * 获取结局统计
     * @returns {Object}
     */
    getEndingStats() {
        const attrs = this.attributeManager.getAll();
        const initialAttrs = this.gameState.character?.initial_attributes || {};

        return {
            depositChange: attrs.deposit - (initialAttrs.deposit || 0),
            weightChange: attrs.weight - (initialAttrs.weight || 65),
            faceChange: attrs.face - (initialAttrs.face || 50),
            moodChange: attrs.mood - (initialAttrs.mood || 50),
            healthChange: attrs.health - (initialAttrs.health || 50),
            totalEvents: this.gameState.statistics.totalEvents,
            totalChoices: this.gameState.statistics.totalChoices
        };
    }
}



// ============================================
// Game - 游戏主控制器
// ============================================

class Game {
    constructor() {
        // 初始化核心组件
        this.state = new GameState();
        this.attributes = new AttributeManager(this.state);
        this.events = new EventManager(this.state, this.attributes);
        this.saves = new SaveManager(this.state);
        this.endings = new EndingManager(this.state, this.attributes);

        // 游戏数据
        this.characters = [];
        this.eventData = [];
        this.endingData = [];

        // UI状态
        this.uiState = {
            selectedCharacterId: null,
            animationEnabled: true,
            soundEnabled: true,
            musicVolume: 50,
            soundVolume: 70
        };

        // 绑定方法
        this.init = this.init.bind(this);
        this.startGame = this.startGame.bind(this);
        this.makeChoice = this.makeChoice.bind(this);
        this.saveGame = this.saveGame.bind(this);
        this.loadGame = this.loadGame.bind(this);
    }

    /**
     * 初始化游戏
     */
    async init() {
        console.log('春节模拟器 v' + GAME_CONFIG.VERSION + ' 初始化中...');

        // 加载设置
        this.loadSettings();

        // 加载游戏数据
        await this.loadGameData();

        // 初始化存档管理器
        this.saves.init();

        // 渲染角色列表
        this.renderCharacters();

        // 渲染存档槽
        this.renderSaveSlots();

        console.log('游戏初始化完成！');
    }

    /**
     * 加载游戏数据
     */
    async loadGameData() {
        try {
            // 加载角色数据
            const charResponse = await fetch('../data/characters.json');
            if (charResponse.ok) {
                const charData = await charResponse.json();
                this.characters = charData.characters || [];
            }
        } catch (e) {
            console.warn('加载角色数据失败，使用默认数据:', e);
            this.loadDefaultCharacters();
        }

        // 加载事件数据
        try {
            const [commonEventsResponse, charEventsResponse, endingsResponse] = await Promise.all([
                fetch('../data/common_events.json'),
                fetch('../data/character_events.json'),
                fetch('../data/endings.json')
            ]);
            
            if (commonEventsResponse.ok) {
                const commonData = await commonEventsResponse.json();
                const commonEvents = this.convertCommonEvents(commonData.events || []);
                this.eventData = [...commonEvents];
            }
            
            if (charEventsResponse.ok) {
                const charEventsData = await charEventsResponse.json();
                const charEvents = this.convertCharacterEvents(charEventsData.events || []);
                this.eventData = [...this.eventData, ...charEvents];
            }
            
            if (endingsResponse.ok) {
                const endingsData = await endingsResponse.json();
                this.endingData = this.convertEndings(endingsData.endings || []);
            }
            
            console.log(`加载了 ${this.eventData.length} 个事件, ${this.endingData.length} 个结局`);
        } catch (e) {
            console.warn('加载外部事件数据失败，使用默认数据:', e);
            this.loadDefaultEvents();
            this.loadDefaultEndings();
        }

        // 设置到管理器
        this.events.loadEvents(this.eventData);
        this.endings.loadEndings(this.endingData);
    }

    /**
     * 转换常规事件格式
     */
    convertCommonEvents(events) {
        return events.map((e, index) => ({
            id: e.event_id || `common_${index}`,
            title: e.event_name || '事件',
            description: e.description || '',
            category: e.type || 'common',
            scene: this.getSceneEmoji(e.event_name),
            location: e.trigger_condition?.scene || '未知地点',
            npc: '👤',
            npcName: '路人',
            weight: Math.floor((e.trigger_condition?.probability || 0.25) * 100),
            onceOnly: false,
            options: (e.options || []).map(opt => ({
                id: opt.option_id || `opt_${index}`,
                text: opt.text || '选择',
                effects: this.convertEffects(opt.effects),
                feedback: opt.result_desc || ''
            }))
        }));
    }

    /**
     * 转换角色专属事件格式
     */
    convertCharacterEvents(events) {
        return events.map((e, index) => ({
            id: e.event_id || `char_${index}`,
            title: e.event_name || '事件',
            description: e.description || '',
            category: 'character',
            scene: this.getSceneEmoji(e.event_name),
            location: '家中',
            npc: '👤',
            npcName: '家人',
            weight: 100,
            onceOnly: true,
            exclusiveTo: [e.character_id].filter(Boolean),
            triggerConditions: e.day ? [{
                type: 'time',
                params: { days: [e.day], periods: this.getPeriodIndex(e.time_slot) }
            }] : [],
            options: (e.options || []).map(opt => ({
                id: opt.option_id || `opt_${index}`,
                text: opt.text || '选择',
                effects: this.convertEffects(opt.effects),
                feedback: opt.result_desc || ''
            }))
        }));
    }

    /**
     * 转换结局格式
     */
    convertEndings(endings) {
        return endings.map((e, index) => {
            const type = e.ending_type || e.type || 'normal';
            const categoryMap = {
                success: 'good',
                failure: 'bad',
                special: 'secret',
                hidden: 'secret',
                normal: 'normal'
            };
            return ({
                id: e.ending_id || `ending_${index}`,
                title: e.ending_name || '结局',
                description: e.description || '',
                category: categoryMap[type] || type,
                icon: e.icon || '🎊',
                priority: e.priority || 0,
                characterId: e.character_id || e.characterId || null,
                unlockConditions: this.convertUnlockConditions(e.unlock_conditions || e.unlockConditions),
                score: { base: e.score || 500 }
            });
        });
    }

    /**
     * 转换效果格式
     */
    convertEffects(effects) {
        if (!effects) return [];
        const result = [];
        const attrMap = {
            'deposit': 'deposit',
            'weight': 'weight',
            'face': 'face',
            'mood': 'mood',
            'health': 'health',
            'luck': 'luck'
        };
        for (const [key, value] of Object.entries(effects)) {
            if (attrMap[key] && value !== 0) {
                result.push({
                    type: 'attribute',
                    attribute: attrMap[key],
                    value: value
                });
            }
        }
        return result;
    }

    /**
     * 转换解锁条件
     */
    convertUnlockConditions(conditions) {
        if (!conditions) return [];

        if (Array.isArray(conditions)) {
            return conditions.map(c => ({
                conditions: (c.conditions || []).map(cond => ({
                    type: 'attribute',
                    attribute: cond.attribute,
                    operator: cond.operator || '>=',
                    value: cond.value
                }))
            }));
        }

        if (typeof conditions === 'object') {
            const attrs = ['deposit', 'weight', 'face', 'mood', 'health', 'luck'];
            const conditionList = [];

            for (const attr of attrs) {
                const minKey = `min_${attr}`;
                const maxKey = `max_${attr}`;
                if (conditions[minKey] !== undefined) {
                    conditionList.push({
                        type: 'attribute',
                        attribute: attr,
                        operator: '>=',
                        value: conditions[minKey]
                    });
                }
                if (conditions[maxKey] !== undefined) {
                    conditionList.push({
                        type: 'attribute',
                        attribute: attr,
                        operator: '<=',
                        value: conditions[maxKey]
                    });
                }
            }

            if (conditionList.length === 0) return [];

            return [{ conditions: conditionList }];
        }

        return [];
    }

    /**
     * 获取场景emoji
     */
    getSceneEmoji(eventName) {
        const emojiMap = {
            '红包': '🧧',
            '拜年': '🏮',
            '饭': '🍜',
            '吃': '🍜',
            '麻将': '🎰',
            '赌': '🎲',
            '购物': '🛍️',
            '买': '🛍️',
            '烟花': '🎆',
            '健身': '🏋️',
            '医生': '🏥',
            '病': '🏥',
            '回家': '🚗',
            '高铁': '🚄',
            '堵车': '🚗',
            '大扫除': '🧹',
            '贴春联': '🧧',
            '初一': '🧧',
            '除夕': '🎊',
            '亲戚': '👨‍👩‍👧‍👦',
            '相亲': '💕',
            '熊孩子': '👶',
            '迎财神': '💰',
            '催婚': '💔',
            '灵魂拷问': '❓'
        };
        for (const [key, emoji] of Object.entries(emojiMap)) {
            if (eventName && eventName.includes(key)) return emoji;
        }
        return '🏠';
    }

    /**
     * 获取时段索引
     */
    getPeriodIndex(timeSlot) {
        const map = {
            'morning': [0],
            'noon': [1],
            'afternoon': [1],
            'evening': [2],
            'night': [2]
        };
        return map[timeSlot] || [0, 1, 2];
    }

    /**
     * 加载默认角色
     */
    loadDefaultCharacters() {
        this.characters = [
            {
                id: 'hao_shitu',
                name: '郝仕途',
                title: '职场精英',
                monologue: '在这个城市，只有努力才能出人头地。',
                avatar: '👨‍💼',
                initial_attributes: { deposit: 158000, weight: 88, face: 100, mood: 95, health: 55, luck: 85 }
            },
            {
                id: 'hua_beibei',
                name: '花贝贝',
                title: '时尚博主',
                monologue: '生活就是要精致，哪怕负债累累也要保持优雅。',
                avatar: '👩‍🦰',
                initial_attributes: { deposit: -32450, weight: 46, face: 80, mood: 40, health: 45, luck: 15 }
            },
            {
                id: 'fan_tong',
                name: '范统',
                title: '普通职员',
                monologue: '平凡也是一种幸福。',
                avatar: '👨‍💻',
                initial_attributes: { deposit: 850, weight: 62, face: 15, mood: 80, health: 30, luck: 60 }
            },
            {
                id: 'gu_jia',
                name: '顾嘉',
                title: '创业者',
                monologue: '失败是成功之母，我会东山再起的！',
                avatar: '💼',
                initial_attributes: { deposit: 66.6, weight: 54, face: -50, mood: 60, health: 90, luck: 50 }
            },
            {
                id: 'ren_xing',
                name: '任兴',
                title: '自由职业者',
                monologue: '随心所欲，活出自我。',
                avatar: '🎨',
                initial_attributes: { deposit: 5000, weight: 50, face: 0, mood: 100, health: 85, luck: 20 }
            },
            {
                id: 'hao_youqian',
                name: '郝有乾',
                title: '企业家',
                monologue: '有钱能使鬼推磨，但我更有梦想。',
                avatar: '💎',
                initial_attributes: { deposit: 12800000, weight: 92, face: 95, mood: 98, health: 60, luck: 90 }
            },
            {
                id: 'bi_chenglong',
                name: '毕成龙',
                title: '演员',
                monologue: '成名之路充满荆棘，但我永不放弃。',
                avatar: '🎭',
                initial_attributes: { deposit: 450000, weight: 52, face: 60, mood: 15, health: 40, luck: 30 }
            },
            {
                id: 'zhen_yangqi',
                name: '甄洋气',
                title: '海归精英',
                monologue: '国外的经历让我与众不同。',
                avatar: '✈️',
                initial_attributes: { deposit: -180000, weight: 65, face: 85, mood: 50, health: 75, luck: 40 }
            },
            {
                id: 'hu_sanwan',
                name: '胡三万',
                title: '赌徒',
                monologue: '人生就是一场豪赌，我命由我不由天！',
                avatar: '🎲',
                initial_attributes: { deposit: 20000, weight: 58, face: 70, mood: 90, health: 35, luck: 99 }
            },
            {
                id: 'wu_renai',
                name: '吴仁爱',
                title: '慈善家',
                monologue: '帮助他人是我最大的快乐。',
                avatar: '❤️',
                initial_attributes: { deposit: 280000, weight: 56, face: -100, mood: 25, health: 65, luck: 5 }
            }
        ];
    }

    /**
     * 加载默认事件
     */
    loadDefaultEvents() {
        this.eventData = [
            {
                id: 'new_year_morning',
                title: '新年早晨',
                description: '妈妈叫你起床，今天是大年初一，要给长辈拜年！',
                category: 'family',
                scene: '🏠',
                location: '家中',
                npc: '👵',
                npcName: '妈妈',
                weight: 100,
                onceOnly: true,
                triggerConditions: [
                    { type: 'time', params: { days: [3], periods: [0] } }
                ],
                options: [
                    {
                        id: 'get_up_early',
                        text: '马上起床，精神饱满地去拜年',
                        effects: [
                            { type: 'attribute', attribute: 'mood', value: 5 },
                            { type: 'attribute', attribute: 'face', value: 10 }
                        ]
                    },
                    {
                        id: 'sleep_a_bit',
                        text: '赖床5分钟再说...',
                        effects: [
                            { type: 'attribute', attribute: 'mood', value: 10 },
                            { type: 'attribute', attribute: 'health', value: 5 },
                            { type: 'attribute', attribute: 'face', value: -5 }
                        ]
                    },
                    {
                        id: 'keep_sleeping',
                        text: '假装没听见继续睡',
                        effects: [
                            { type: 'attribute', attribute: 'mood', value: 15 },
                            { type: 'attribute', attribute: 'face', value: -15 },
                            { type: 'attribute', attribute: 'health', value: -5 }
                        ]
                    }
                ]
            },
            {
                id: 'relative_question',
                title: '亲戚的灵魂拷问',
                description: '大舅问你：工作怎么样？工资多少？有对象了吗？',
                category: 'family',
                scene: '🏮',
                location: '亲戚家',
                npc: '👨‍🦳',
                npcName: '大舅',
                weight: 80,
                onceOnly: false,
                options: [
                    {
                        id: 'polite_answer',
                        text: '礼貌回答，转移话题',
                        effects: [
                            { type: 'attribute', attribute: 'face', value: 5 },
                            { type: 'attribute', attribute: 'mood', value: -5 }
                        ]
                    },
                    {
                        id: 'honest_answer',
                        text: '实话实说，坦诚相待',
                        effects: [
                            { type: 'attribute', attribute: 'face', value: 10 },
                            { type: 'attribute', attribute: 'mood', value: -10 }
                        ]
                    },
                    {
                        id: 'escape',
                        text: '找借口溜去厨房帮忙',
                        effects: [
                            { type: 'attribute', attribute: 'mood', value: 5 },
                            { type: 'attribute', attribute: 'health', value: -3 }
                        ]
                    }
                ]
            },
            {
                id: 'new_year_dinner',
                title: '年夜饭',
                description: '全家人围坐在一起吃年夜饭，妈妈做了你最爱吃的红烧肉...',
                category: 'food',
                scene: '🍜',
                location: '餐厅',
                npc: '👩‍🍳',
                npcName: '妈妈',
                weight: 100,
                onceOnly: true,
                triggerConditions: [
                    { type: 'time', params: { days: [2], periods: [1] } }
                ],
                options: [
                    {
                        id: 'eat_more',
                        text: '大吃一顿，难得回家',
                        effects: [
                            { type: 'attribute', attribute: 'weight', value: 2 },
                            { type: 'attribute', attribute: 'mood', value: 15 },
                            { type: 'attribute', attribute: 'health', value: -5 }
                        ]
                    },
                    {
                        id: 'eat_normal',
                        text: '正常吃饭，注意节制',
                        effects: [
                            { type: 'attribute', attribute: 'weight', value: 0.5 },
                            { type: 'attribute', attribute: 'mood', value: 5 },
                            { type: 'attribute', attribute: 'health', value: 2 }
                        ]
                    },
                    {
                        id: 'diet',
                        text: '控制饮食，保持身材',
                        availabilityConditions: [
                            { type: 'attribute', params: { attribute: 'health', operator: '>=', value: 60 } }
                        ],
                        effects: [
                            { type: 'attribute', attribute: 'weight', value: -0.5 },
                            { type: 'attribute', attribute: 'mood', value: -5 },
                            { type: 'attribute', attribute: 'face', value: 5 }
                        ]
                    }
                ]
            },
            {
                id: 'mahjong_invite',
                title: '麻将邀请',
                description: '表哥邀请你：来，过年打几圈麻将，小赌怡情！',
                category: 'social',
                scene: '🎰',
                location: '棋牌室',
                npc: '👨‍🦱',
                npcName: '表哥',
                weight: 60,
                onceOnly: false,
                options: [
                    {
                        id: 'play_big',
                        text: '好，来几圈！',
                        effects: [
                            { type: 'attribute', attribute: 'deposit', value: -500 },
                            { type: 'attribute', attribute: 'mood', value: 10 },
                            { type: 'attribute', attribute: 'luck', value: 5 }
                        ]
                    },
                    {
                        id: 'play_small',
                        text: '玩小的，输赢不大',
                        effects: [
                            { type: 'attribute', attribute: 'deposit', value: -100 },
                            { type: 'attribute', attribute: 'mood', value: 5 }
                        ]
                    },
                    {
                        id: 'refuse',
                        text: '不会玩，看你们打',
                        effects: [
                            { type: 'attribute', attribute: 'face', value: -5 }
                        ]
                    }
                ]
            },
            {
                id: 'shopping_sale',
                title: '商场促销',
                description: '新年大促销！全场5折起，买满1000送200！',
                category: 'money',
                scene: '🛍️',
                location: '商场',
                npc: '👩',
                npcName: '导购',
                weight: 50,
                onceOnly: false,
                options: [
                    {
                        id: 'buy_buy_buy',
                        text: '买买买！新年新气象',
                        effects: [
                            { type: 'attribute', attribute: 'deposit', value: -1500 },
                            { type: 'attribute', attribute: 'mood', value: 15 },
                            { type: 'attribute', attribute: 'face', value: 10 }
                        ]
                    },
                    {
                        id: 'buy_necessity',
                        text: '只买必需品',
                        effects: [
                            { type: 'attribute', attribute: 'deposit', value: -300 },
                            { type: 'attribute', attribute: 'mood', value: 3 }
                        ]
                    },
                    {
                        id: 'no_buy',
                        text: '理性消费，不买了',
                        effects: [
                            { type: 'attribute', attribute: 'mood', value: -3 }
                        ]
                    }
                ]
            },
            {
                id: 'red_envelope',
                title: '红包来了',
                description: '侄子跑过来：叔叔/阿姨，新年好！红包拿来！',
                category: 'money',
                scene: '🧧',
                location: '客厅',
                npc: '👶',
                npcName: '侄子',
                weight: 70,
                onceOnly: false,
                options: [
                    {
                        id: 'big_red_envelope',
                        text: '给个大红包！',
                        effects: [
                            { type: 'attribute', attribute: 'deposit', value: -500 },
                            { type: 'attribute', attribute: 'face', value: 15 },
                            { type: 'attribute', attribute: 'mood', value: 5 }
                        ]
                    },
                    {
                        id: 'normal_red_envelope',
                        text: '给个普通红包',
                        effects: [
                            { type: 'attribute', attribute: 'deposit', value: -200 },
                            { type: 'attribute', attribute: 'face', value: 5 }
                        ]
                    },
                    {
                        id: 'no_red_envelope',
                        text: '说几句吉利话，红包下次给',
                        effects: [
                            { type: 'attribute', attribute: 'face', value: -10 },
                            { type: 'attribute', attribute: 'mood', value: -5 }
                        ]
                    }
                ]
            },
            {
                id: 'wechat_red_packet',
                title: '微信群红包',
                description: '家族群里发红包了，手慢无！',
                category: 'money',
                scene: '📱',
                location: '微信群',
                npc: '🧧',
                npcName: '家族群',
                weight: 60,
                onceOnly: false,
                options: [
                    {
                        id: 'grab_packet',
                        text: '抢红包！',
                        effects: [
                            { type: 'attribute', attribute: 'deposit', value: 50 },
                            { type: 'attribute', attribute: 'mood', value: 10 },
                            { type: 'attribute', attribute: 'luck', value: 3 }
                        ]
                    },
                    {
                        id: 'send_packet',
                        text: '我也发一个',
                        effects: [
                            { type: 'attribute', attribute: 'deposit', value: -200 },
                            { type: 'attribute', attribute: 'face', value: 10 },
                            { type: 'attribute', attribute: 'mood', value: 5 }
                        ]
                    },
                    {
                        id: 'ignore',
                        text: '静音模式，没看到',
                        effects: []
                    }
                ]
            },
            {
                id: 'firework_show',
                title: '烟花表演',
                description: '小伙伴叫你：走，放烟花去！今晚有大型烟花表演！',
                category: 'social',
                scene: '🎆',
                location: '广场',
                npc: '👦',
                npcName: '小伙伴',
                weight: 50,
                onceOnly: false,
                options: [
                    {
                        id: 'buy_firework',
                        text: '一起去，买最贵的烟花',
                        effects: [
                            { type: 'attribute', attribute: 'deposit', value: -300 },
                            { type: 'attribute', attribute: 'mood', value: 15 },
                            { type: 'attribute', attribute: 'luck', value: 5 }
                        ]
                    },
                    {
                        id: 'watch_only',
                        text: '看看就好，不买烟花',
                        effects: [
                            { type: 'attribute', attribute: 'mood', value: 8 }
                        ]
                    },
                    {
                        id: 'stay_home',
                        text: '在家看电视直播',
                        effects: [
                            { type: 'attribute', attribute: 'mood', value: 3 },
                            { type: 'attribute', attribute: 'health', value: 3 }
                        ]
                    }
                ]
            },
            {
                id: 'gym_invite',
                title: '健身邀请',
                description: '教练提醒你：过年也要保持锻炼啊，来运动一下？',
                category: 'health',
                scene: '🏋️',
                location: '健身房',
                npc: '💪',
                npcName: '教练',
                weight: 40,
                onceOnly: false,
                options: [
                    {
                        id: 'buy_membership',
                        text: '办卡！新年新身材',
                        effects: [
                            { type: 'attribute', attribute: 'deposit', value: -2000 },
                            { type: 'attribute', attribute: 'health', value: 15 },
                            { type: 'attribute', attribute: 'weight', value: -5 }
                        ]
                    },
                    {
                        id: 'one_time',
                        text: '今天先练一次',
                        effects: [
                            { type: 'attribute', attribute: 'deposit', value: -100 },
                            { type: 'attribute', attribute: 'health', value: 5 },
                            { type: 'attribute', attribute: 'weight', value: -2 }
                        ]
                    },
                    {
                        id: 'later',
                        text: '年后再说',
                        effects: [
                            { type: 'attribute', attribute: 'weight', value: 3 }
                        ]
                    }
                ]
            },
            {
                id: 'doctor_reminder',
                title: '医生提醒',
                description: '医生叮嘱你：过年别吃太多油腻的，注意身体啊！',
                category: 'health',
                scene: '🏥',
                location: '医院',
                npc: '👨‍⚕️',
                npcName: '医生',
                weight: 30,
                onceOnly: false,
                options: [
                    {
                        id: 'listen_doctor',
                        text: '听医生的，注意饮食',
                        effects: [
                            { type: 'attribute', attribute: 'health', value: 10 },
                            { type: 'attribute', attribute: 'mood', value: -5 }
                        ]
                    },
                    {
                        id: 'ignore_doctor',
                        text: '过年嘛，该吃吃该喝喝',
                        effects: [
                            { type: 'attribute', attribute: 'health', value: -10 },
                            { type: 'attribute', attribute: 'weight', value: 5 },
                            { type: 'attribute', attribute: 'mood', value: 10 }
                        ]
                    },
                    {
                        id: 'buy_supplement',
                        text: '买点保健品补补',
                        effects: [
                            { type: 'attribute', attribute: 'deposit', value: -500 },
                            { type: 'attribute', attribute: 'health', value: 5 }
                        ]
                    }
                ]
            }
        ];
    }

    /**
     * 加载默认结局
     */
    loadDefaultEndings() {
        this.endingData = [
            {
                id: 'wealth_legend',
                title: '财富传奇',
                description: '你带着丰厚的存款回到城市，这个春节你不仅过得开心，还赚得盆满钵满！',
                category: 'perfect',
                icon: '💰',
                priority: 100,
                unlockConditions: [
                    {
                        conditions: [
                            { type: 'attribute', attribute: 'deposit', operator: '>=', value: 50000 },
                            { type: 'attribute', attribute: 'face', operator: '>=', value: 90 }
                        ]
                    }
                ],
                score: { base: 2000 }
            },
            {
                id: 'happy_family',
                title: '阖家欢乐',
                description: '你度过了一个温馨快乐的春节，家人的笑容是你最大的收获。',
                category: 'perfect',
                icon: '👨‍👩‍👧‍👦',
                priority: 95,
                unlockConditions: [
                    {
                        conditions: [
                            { type: 'attribute', attribute: 'mood', operator: '>=', value: 90 },
                            { type: 'attribute', attribute: 'health', operator: '>=', value: 80 },
                            { type: 'attribute', attribute: 'face', operator: '>=', value: 70 }
                        ]
                    }
                ],
                score: { base: 1800 }
            },
            {
                id: 'balanced_life',
                title: '平衡人生',
                description: '你在各方面都保持了良好的平衡，这是一个充实而有意义的春节。',
                category: 'good',
                icon: '⚖️',
                priority: 80,
                unlockConditions: [
                    {
                        conditions: [
                            { type: 'attribute', attribute: 'deposit', operator: '>=', value: 0 },
                            { type: 'attribute', attribute: 'face', operator: '>=', value: 50 },
                            { type: 'attribute', attribute: 'mood', operator: '>=', value: 50 },
                            { type: 'attribute', attribute: 'health', operator: '>=', value: 50 }
                        ]
                    }
                ],
                score: { base: 1200 }
            },
            {
                id: 'career_success',
                title: '事业有成',
                description: '你的事业蒸蒸日上，在亲戚朋友面前很有面子。',
                category: 'good',
                icon: '💼',
                priority: 75,
                unlockConditions: [
                    {
                        conditions: [
                            { type: 'attribute', attribute: 'deposit', operator: '>=', value: 30000 },
                            { type: 'attribute', attribute: 'face', operator: '>=', value: 70 }
                        ]
                    }
                ],
                score: { base: 1000 }
            },
            {
                id: 'healthy_life',
                title: '养生达人',
                description: '你成功抵制了各种诱惑，保持了良好的健康状态。',
                category: 'good',
                icon: '💪',
                priority: 70,
                unlockConditions: [
                    {
                        conditions: [
                            { type: 'attribute', attribute: 'health', operator: '>=', value: 85 },
                            { type: 'attribute', attribute: 'weight', operator: '<=', value: 70 }
                        ]
                    }
                ],
                score: { base: 900 }
            },
            {
                id: 'ordinary_spring',
                title: '平凡春节',
                description: '一个普通的春节，有喜有忧，这就是生活的常态。',
                category: 'normal',
                icon: '🎊',
                priority: 10,
                unlockConditions: [],
                score: { base: 500 }
            },
            {
                id: 'broke_return',
                title: '破产返乡',
                description: '这个春节让你花光了所有积蓄，回去后要勒紧裤腰带过日子了。',
                category: 'bad',
                icon: '💸',
                priority: 60,
                unlockConditions: [
                    {
                        conditions: [
                            { type: 'attribute', attribute: 'deposit', operator: '<=', value: -10000 }
                        ]
                    }
                ],
                score: { base: 200 }
            },
            {
                id: 'family_conflict',
                title: '家庭矛盾',
                description: '春节期间的一些不愉快让你和家人之间产生了隔阂。',
                category: 'bad',
                icon: '💔',
                priority: 55,
                unlockConditions: [
                    {
                        conditions: [
                            { type: 'attribute', attribute: 'face', operator: '<=', value: 20 },
                            { type: 'attribute', attribute: 'mood', operator: '<=', value: 20 }
                        ]
                    }
                ],
                score: { base: 150 }
            },
            {
                id: 'health_crisis',
                title: '健康危机',
                description: '过度的应酬和放纵让你的健康亮起了红灯。',
                category: 'bad',
                icon: '🏥',
                priority: 50,
                unlockConditions: [
                    {
                        conditions: [
                            { type: 'attribute', attribute: 'health', operator: '<=', value: 15 }
                        ]
                    }
                ],
                score: { base: 100 }
            },
            {
                id: 'secret_lottery',
                title: '彩票大奖',
                description: '你的运气爆棚，意外中了大奖！这是传说中的隐藏结局！',
                category: 'secret',
                icon: '🎰',
                priority: 200,
                hidden: true,
                unlockConditions: [
                    {
                        conditions: [
                            { type: 'attribute', attribute: 'luck', operator: '>=', value: 95 },
                            { type: 'attribute', attribute: 'deposit', operator: '>=', value: 100000 }
                        ]
                    }
                ],
                score: { base: 5000 }
            }
        ];
    }

    // ============================================
    // UI 相关方法
    // ============================================

    /**
     * 切换屏幕
     * @param {string} screenId - 屏幕ID
     */
    switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
        this.state.currentScreen = screenId.replace('-screen', '');
    }

    /**
     * 返回开始界面
     */
    toStartScreen() {
        this.switchScreen('start-screen');
    }

    /**
     * 前往角色选择
     */
    toCharacterSelect() {
        this.renderCharacters();
        this.switchScreen('character-screen');
    }

    /**
     * 前往存档界面
     */
    toLoadGame() {
        this.renderSaveSlots();
        this.switchScreen('save-screen');
    }

    /**
     * 返回上一页
     */
    goBack() {
        if (this.state.character) {
            this.switchScreen('game-screen');
        } else {
            this.switchScreen('start-screen');
        }
    }

    /**
     * 渲染角色列表
     */
    renderCharacters() {
        const grid = document.getElementById('character-grid');
        if (!grid) return;

        grid.innerHTML = this.characters.map(char => {
            const avatarHtml = char.avatar && char.avatar.endsWith('.png') 
                ? `<img src="${char.avatar}" alt="${char.name}" class="w-12 h-12 rounded-full object-cover border-2 border-black">`
                : `<div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl border-2 border-black">${char.avatar || '👤'}</div>`;
            
            return `
            <button
                class="character-card w-full p-4 text-left border-2 transition-all flex items-center gap-4 ${this.uiState.selectedCharacterId === char.id ? 'selected' : 'bg-white border-gray-200'}"
                data-id="${char.id}"
                onclick="game.selectCharacter('${char.id}')"
            >
                ${avatarHtml}
                <div class="character-card-info">
                    <div class="character-card-name">${char.name}</div>
                    <div class="character-card-role">${char.identity || char.title || '普通角色'}</div>
                </div>
            </button>
        `}).join('');
    }

    /**
     * 选择角色
     * @param {string} id - 角色ID
     */
    selectCharacter(id) {
        const character = this.characters.find(c => c.id === id);
        if (!character) return;

        this.uiState.selectedCharacterId = id;

        // 更新UI
        document.querySelectorAll('.character-card').forEach(card => {
            card.classList.remove('selected');
            card.classList.add('bg-white', 'border-gray-200');
        });
        const selectedCard = document.querySelector(`.character-card[data-id="${id}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            selectedCard.classList.remove('bg-white', 'border-gray-200');
        }

        // 更新详情面板
        const detailPanel = document.getElementById('character-detail-content');
        if (detailPanel && character) {
            const statsHtml = character.initial_attributes ? 
                Object.entries(character.initial_attributes)
                    .map(([key, value]) => `<span class="stat-tag">${ATTRIBUTE_NAMES[key] || key}: ${value}</span>`)
                    .join('') : '';
            
            const detailAvatarHtml = character.avatar && character.avatar.endsWith('.png')
                ? `<img src="${character.avatar}" alt="${character.name}" class="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-black shadow-[8px_8px_0px_#fbbf24]">`
                : `<div class="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gray-200 flex items-center justify-center text-6xl border-4 border-black shadow-[8px_8px_0px_#fbbf24]">${character.avatar || '👤'}</div>`;
            
            detailPanel.innerHTML = `
                <div class="w-full md:w-1/2 space-y-4">
                    <div class="relative flex flex-col items-center">
                        ${detailAvatarHtml}
                        <div class="character-detail-name mt-4 text-2xl font-black text-white">${character.name}</div>
                    </div>
                    <div class="character-detail-quote bg-gray-50 p-4 border-2 border-black italic text-sm">
                        "${character.monologue || character.description || '这个春节，我要过得不一样！'}"
                    </div>
                </div>
                <div class="w-full md:w-1/2 flex flex-col justify-between space-y-4">
                    <div>
                        <h3 class="text-xl font-black mb-4 flex items-center gap-2">
                            <span class="bg-black text-white px-2">STATS</span>
                            <span class="text-festive-red">初始属性</span>
                        </h3>
                        <div class="flex flex-wrap gap-2">
                            ${statsHtml}
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4 mt-4">
                        <button onclick="game.toStartScreen()" class="py-3 bg-gray-200 border-4 border-black font-bold hover:bg-gray-300 transition-colors">
                            取消
                        </button>
                        <button onclick="game.confirmCharacter()" class="py-3 bg-festive-red text-white border-4 border-black font-bold shadow-[4px_4px_0px_#fbbf24] hover:scale-105 active:scale-95 transition-all">
                            开启挑战
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * 确认角色选择
     */
    confirmCharacter() {
        const character = this.characters.find(c => c.id === this.uiState.selectedCharacterId);
        if (!character) return;

        this.startGame(character);
    }

    /**
     * 开始游戏
     * @param {Object} character - 选择的角色
     */
    startGame(character) {
        // 初始化游戏状态
        this.state.initNewGame(character);

        // 更新UI
        this.updateDayDisplay();
        this.updateStatsDisplay();
        this.generateEvent();
        this.switchScreen('game-screen');

        this.showNotification(`选择了${character.name}，游戏开始！`);
    }

    /**
     * 更新日期显示
     */
    updateDayDisplay() {
        const dayDisplay = document.getElementById('day-display');
        const timeDisplay = document.getElementById('time-display');
        const progressText = document.getElementById('progress-text');
        const progressBar = document.getElementById('progress-bar');

        const dayName = GAME_CONFIG.DAY_NAMES[this.state.progress.currentDay - 1] || `第${this.state.progress.currentDay}天`;
        const periodName = GAME_CONFIG.PERIOD_NAMES[this.state.progress.currentPeriod];
        const totalPeriods = GAME_CONFIG.TOTAL_DAYS * GAME_CONFIG.PERIODS_PER_DAY;
        const currentPeriodNum = (this.state.progress.currentDay - 1) * GAME_CONFIG.PERIODS_PER_DAY + this.state.progress.currentPeriod + 1;
        const progressPercent = (currentPeriodNum / totalPeriods) * 100;

        if (dayDisplay) dayDisplay.textContent = dayName;
        if (timeDisplay) timeDisplay.textContent = periodName;
        if (progressText) progressText.textContent = `${currentPeriodNum}/${totalPeriods}`;
        if (progressBar) progressBar.style.width = `${progressPercent}%`;
    }

    /**
     * 更新属性显示
     */
    updateStatsDisplay() {
        const attrs = this.state.attributes;
        const statMap = {
            'deposit': 'money',
            'weight': 'weight',
            'face': 'face',
            'mood': 'mood',
            'health': 'health',
            'luck': 'luck'
        };

        for (const [key, value] of Object.entries(attrs)) {
            const displayKey = statMap[key] || key;
            const statValue = document.getElementById(`stat-${displayKey}`);

            if (statValue) {
                statValue.textContent = this.formatAttributeValue(key, value);
            }
        }
    }

    /**
     * 格式化属性值
     * @param {string} key - 属性名
     * @param {number} value - 属性值
     * @returns {string}
     */
    formatAttributeValue(key, value) {
        if (key === 'deposit') {
            if (value >= 10000) {
                return (value / 10000).toFixed(1) + '万';
            }
            return value.toString();
        }
        return Math.round(value).toString();
    }

    /**
     * 生成事件
     */
    generateEvent() {
        const event = this.events.getNextEvent();
        this.state.currentEvent = event;

        // 更新事件显示
        const sceneImage = document.getElementById('scene-image');
        const sceneLocation = document.getElementById('scene-location');
        const npcAvatar = document.getElementById('npc-avatar');
        const npcName = document.getElementById('npc-name');
        const eventTitle = document.getElementById('event-title');
        const eventDescription = document.getElementById('event-description');
        const choicesPanel = document.getElementById('choices-panel');

        if (sceneImage) sceneImage.textContent = event.scene || '🏠';
        if (sceneLocation) sceneLocation.textContent = event.location || '未知地点';
        if (npcAvatar) npcAvatar.textContent = event.npc || '👤';
        if (npcName) npcName.textContent = event.npcName || '未知';
        if (eventTitle) eventTitle.textContent = event.title || '新的事件';
        if (eventDescription) eventDescription.textContent = event.description || '无事发生...';

        // 更新选项
        if (choicesPanel) {
            const availableOptions = this.events.getAvailableOptions(event);
            choicesPanel.innerHTML = availableOptions.map((option, index) => {
                const effectText = this.formatEffects(option.effects);
                const disabledClass = option.available ? '' : 'opacity-50 cursor-not-allowed';
                const unavailableTip = option.available ? '' : `title="${option.unavailableReason}"`;
                const btnNumber = index + 1;

                return `
                    <button class="choice-btn w-full p-4 text-left border-4 border-black bg-white hover:bg-festive-gold/20 hover:translate-x-2 transition-all flex items-center gap-4 group ${disabledClass}" 
                            onclick="game.makeChoice(${option.index})" 
                            ${unavailableTip}
                            ${option.available ? '' : 'disabled'}>
                        <span class="choice-number">${btnNumber}</span>
                        <div class="flex-1">
                            <span class="choice-text block">${option.text}</span>
                        </div>
                    </button>
                `;
            }).join('');
        }
    }

    /**
     * 格式化效果文本
     * @param {Array} effects - 效果数组
     * @returns {string}
     */
    formatEffects(effects) {
        if (!effects || effects.length === 0) return '';

        return effects
            .filter(e => e.type === 'attribute' || e.attribute)
            .map(e => {
                const attrName = ATTRIBUTE_NAMES[e.attribute] || e.attribute;
                const sign = e.value >= 0 ? '+' : '';
                return `${attrName}${sign}${e.value}`;
            })
            .join(' ');
    }

    /**
     * 做出选择
     * @param {number} choiceIndex - 选择索引
     */
    makeChoice(choiceIndex) {
        const event = this.state.currentEvent;
        if (!event) return;

        const result = this.events.processChoice(event, choiceIndex);
        if (!result) return;

        // 更新UI
        this.updateStatsDisplay();

        // 显示效果提示
        if (result.effectResults && result.effectResults.length > 0) {
            const effectText = result.effectResults
                .map(r => `${ATTRIBUTE_NAMES[r.attribute]}${r.change >= 0 ? '+' : ''}${Math.round(r.change)}`)
                .join('，');
            this.showNotification(effectText);
        }

        // 检查特殊结果
        if (result.specialOutcome) {
            if (result.specialOutcome.type === 'game_over' || result.specialOutcome.type === 'ending_trigger') {
                this.showEnding();
                return;
            }
        }

        // 推进时间
        const isNewDay = this.state.advanceTime();

        // 检查游戏是否结束
        if (this.state.isGameOver()) {
            this.showEnding();
            return;
        }

        // 更新显示
        this.updateDayDisplay();

        // 新的一天提示
        if (isNewDay) {
            const dayName = GAME_CONFIG.DAY_NAMES[this.state.progress.currentDay - 1];
            this.showNotification(`进入${dayName}`);
        }

        // 生成下一个事件
        setTimeout(() => {
            this.generateEvent();
        }, 300);
    }

    /**
     * 显示结局
     */
    showEnding() {
        const ending = this.endings.determineEnding(this.state.attributes, this.state.character?.initial_attributes);

        // 更新结局界面
        const endingTitle = document.getElementById('ending-title');
        const endingDescription = document.getElementById('ending-description');
        const finalStats = document.getElementById('final-stats');
        const endingStory = document.getElementById('ending-story');

        if (endingTitle) endingTitle.textContent = ending.name || ending.title || '春节结束';
        if (endingDescription) endingDescription.textContent = ending.description || '你度过了一个难忘的春节。';

        // 最终属性
        if (finalStats) {
            const statsToShow = ending.finalStats || this.state.attributes;
            finalStats.innerHTML = Object.entries(statsToShow)
                .map(([key, value]) => `
                    <div class="final-stat-box">
                        <div class="final-stat-icon">${ATTRIBUTE_ICONS[key] || '📊'}</div>
                        <div class="final-stat-name">${ATTRIBUTE_NAMES[key] || key}</div>
                        <div class="final-stat-value">${this.formatAttributeValue(key, value)}</div>
                    </div>
                `).join('');
        }

        // 假期回顾
        if (endingStory) {
            const history = this.state.eventHistory;
            let storyHtml = '';
            if (history && history.length > 0) {
                storyHtml = `<p class="mb-2">这个春节，你经历了${history.length}个事件。</p>`;
                if (ending.story) {
                    storyHtml += `<p>${ending.story}</p>`;
                }
            } else {
                storyHtml = '<p>这是一个平静的春节...</p>';
            }
            endingStory.innerHTML = storyHtml;
        }

        // 显示分数
        if (ending.score !== undefined) {
            this.showNotification(`最终得分: ${ending.score}`);
        }

        this.switchScreen('ending-screen');
    }

    /**
     * 重新开始游戏
     */
    restartGame() {
        this.state.reset();
        this.uiState.selectedCharacterId = null;

        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) confirmBtn.disabled = true;

        document.querySelectorAll('.character-card').forEach(card => {
            card.classList.remove('selected');
        });

        this.toCharacterSelect();
    }

    // ============================================
    // 存档相关方法
    // ============================================

    /**
     * 保存游戏
     */
    saveGame() {
        const slotIndex = this.saves.findEmptySlot();
        if (slotIndex === -1) {
            // 覆盖最早的存档
            this.saves.createSave(0, '手动存档');
        } else {
            this.saves.createSave(slotIndex, '手动存档');
        }

        this.renderSaveSlots();
        this.showNotification('游戏已保存！');
    }

    /**
     * 加载游戏
     * @param {number} slotIndex - 存档槽索引
     */
    loadGame(slotIndex) {
        if (this.saves.loadSave(slotIndex)) {
            this.updateDayDisplay();
            this.updateStatsDisplay();
            this.generateEvent();
            this.switchScreen('game-screen');
            this.showNotification('存档已读取！');
        }
    }

    /**
     * 渲染存档槽
     */
    renderSaveSlots() {
        const container = document.getElementById('save-slots');
        if (!container) return;

        const saves = this.saves.getAllSaves();

        container.innerHTML = saves.map((save, index) => {
            if (save && save.date) {
                const charName = save.gameState?.character?.name || '未知角色';
                const day = save.gameState?.progress?.currentDay || 1;
                const period = save.gameState?.progress?.currentPeriod || 0;

                return `
                    <div class="save-slot">
                        <div class="save-slot-number">${index + 1}</div>
                        <div class="save-info">
                            <div class="save-date">${save.dateDisplay || save.date}</div>
                            <div class="save-details">${charName} - 第${day}天 ${GAME_CONFIG.PERIOD_NAMES[period]}</div>
                        </div>
                        <div class="save-actions">
                            <button class="btn btn-primary btn-small" onclick="game.loadSave(${index})">读取</button>
                            <button class="btn btn-secondary btn-small" onclick="game.deleteSave(${index})">删除</button>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="save-slot empty">
                        <div class="save-slot-number">${index + 1}</div>
                        <div class="save-info">
                            <div class="save-date">空存档槽</div>
                            <div class="save-details">点击开始游戏创建新存档</div>
                        </div>
                        <div class="save-actions">
                            <button class="btn btn-secondary btn-small" disabled>读取</button>
                            <button class="btn btn-secondary btn-small" disabled>删除</button>
                        </div>
                    </div>
                `;
            }
        }).join('');
    }

    /**
     * 读取存档（供UI调用）
     * @param {number} index - 存档索引
     */
    loadSave(index) {
        this.loadGame(index);
    }

    /**
     * 删除存档
     * @param {number} index - 存档索引
     */
    deleteSave(index) {
        if (confirm('确定要删除这个存档吗？')) {
            this.saves.deleteSave(index);
            this.renderSaveSlots();
            this.showNotification('存档已删除！');
        }
    }

    // ============================================
    // 设置相关方法
    // ============================================

    /**
     * 加载设置
     */
    loadSettings() {
        const settings = this.saves.loadSettings();
        this.uiState = { ...this.uiState, ...settings };
    }

    /**
     * 保存设置
     */
    saveSettings() {
        this.saves.saveSettings(this.uiState);
    }

    /**
     * 显示设置
     */
    showSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.add('active');
    }

    /**
     * 关闭设置
     */
    closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.remove('active');
        this.saveSettings();
    }

    // ============================================
    // 工具方法
    // ============================================

    /**
     * 显示通知
     * @param {string} message - 消息内容
     */
    showNotification(message) {
        const notification = document.getElementById('notification');
        if (!notification) return;

        notification.textContent = message;
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// ============================================
// 初始化游戏
// ============================================

// 创建全局游戏实例
const game = new Game();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    game.init();
});

// 点击模态框外部关闭
document.addEventListener('click', (e) => {
    const modal = document.getElementById('settings-modal');
    if (e.target === modal) {
        game.closeSettings();
    }
});

// 导出模块（如果需要）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Game,
        GameState,
        AttributeManager,
        EventManager,
        SaveManager,
        EndingManager,
        GAME_CONFIG,
        ATTRIBUTE_BOUNDS
    };
}
