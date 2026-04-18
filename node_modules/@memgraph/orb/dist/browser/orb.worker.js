(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["Orb"] = factory();
	else
		root["Orb"] = factory();
})(self, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/simulator/engine/d3-simulator-engine.ts":
/*!*****************************************************!*\
  !*** ./src/simulator/engine/d3-simulator-engine.ts ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "D3SimulatorEngine": () => (/* binding */ D3SimulatorEngine),
/* harmony export */   "D3SimulatorEngineEventType": () => (/* binding */ D3SimulatorEngineEventType),
/* harmony export */   "DEFAULT_SETTINGS": () => (/* binding */ DEFAULT_SETTINGS),
/* harmony export */   "getManyBodyMaxDistance": () => (/* binding */ getManyBodyMaxDistance)
/* harmony export */ });
/* harmony import */ var d3_force__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! d3-force */ "./node_modules/d3-force/src/link.js");
/* harmony import */ var d3_force__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! d3-force */ "./node_modules/d3-force/src/simulation.js");
/* harmony import */ var d3_force__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! d3-force */ "./node_modules/d3-force/src/collide.js");
/* harmony import */ var d3_force__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! d3-force */ "./node_modules/d3-force/src/manyBody.js");
/* harmony import */ var d3_force__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! d3-force */ "./node_modules/d3-force/src/x.js");
/* harmony import */ var d3_force__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! d3-force */ "./node_modules/d3-force/src/y.js");
/* harmony import */ var d3_force__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! d3-force */ "./node_modules/d3-force/src/center.js");
/* harmony import */ var _utils_emitter_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../utils/emitter.utils */ "./src/utils/emitter.utils.ts");
/* harmony import */ var _utils_object_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../utils/object.utils */ "./src/utils/object.utils.ts");



const MANY_BODY_MAX_DISTANCE_TO_LINK_DISTANCE_RATIO = 100;
const DEFAULT_LINK_DISTANCE = 30;
var D3SimulatorEngineEventType;
(function (D3SimulatorEngineEventType) {
    D3SimulatorEngineEventType["TICK"] = "tick";
    D3SimulatorEngineEventType["END"] = "end";
    D3SimulatorEngineEventType["SIMULATION_START"] = "simulation-start";
    D3SimulatorEngineEventType["SIMULATION_PROGRESS"] = "simulation-progress";
    D3SimulatorEngineEventType["SIMULATION_END"] = "simulation-end";
    D3SimulatorEngineEventType["NODE_DRAG"] = "node-drag";
    D3SimulatorEngineEventType["SETTINGS_UPDATE"] = "settings-update";
})(D3SimulatorEngineEventType || (D3SimulatorEngineEventType = {}));
const getManyBodyMaxDistance = (linkDistance) => {
    const distance = linkDistance > 0 ? linkDistance : 1;
    return distance * MANY_BODY_MAX_DISTANCE_TO_LINK_DISTANCE_RATIO;
};
const DEFAULT_SETTINGS = {
    isPhysicsEnabled: false,
    alpha: {
        alpha: 1,
        alphaMin: 0.001,
        alphaDecay: 0.0228,
        alphaTarget: 0.1,
    },
    centering: {
        x: 0,
        y: 0,
        strength: 1,
    },
    collision: {
        radius: 15,
        strength: 1,
        iterations: 1,
    },
    links: {
        distance: DEFAULT_LINK_DISTANCE,
        strength: undefined,
        iterations: 1,
    },
    manyBody: {
        strength: -100,
        theta: 0.9,
        distanceMin: 0,
        distanceMax: getManyBodyMaxDistance(DEFAULT_LINK_DISTANCE),
    },
    positioning: {
        forceX: {
            x: 0,
            strength: 0.1,
        },
        forceY: {
            y: 0,
            strength: 0.1,
        },
    },
};
class D3SimulatorEngine extends _utils_emitter_utils__WEBPACK_IMPORTED_MODULE_0__.Emitter {
    constructor(settings) {
        super();
        this._edges = [];
        this._nodes = [];
        this._nodeIndexByNodeId = {};
        this._isDragging = false;
        this._isStabilizing = false;
        this.linkForce = (0,d3_force__WEBPACK_IMPORTED_MODULE_2__["default"])(this._edges).id((node) => node.id);
        this.simulation = (0,d3_force__WEBPACK_IMPORTED_MODULE_3__["default"])(this._nodes).force('link', this.linkForce).stop();
        this.settings = Object.assign((0,_utils_object_utils__WEBPACK_IMPORTED_MODULE_1__.copyObject)(DEFAULT_SETTINGS), settings);
        this.initSimulation(this.settings);
        this.simulation.on('tick', () => {
            this.emit(D3SimulatorEngineEventType.TICK, { nodes: this._nodes, edges: this._edges });
        });
        this.simulation.on('end', () => {
            this._isDragging = false;
            this._isStabilizing = false;
            this.emit(D3SimulatorEngineEventType.END, { nodes: this._nodes, edges: this._edges });
        });
    }
    getSettings() {
        return (0,_utils_object_utils__WEBPACK_IMPORTED_MODULE_1__.copyObject)(this.settings);
    }
    setSettings(settings) {
        const previousSettings = this.getSettings();
        Object.keys(settings).forEach((key) => {
            // @ts-ignore
            this.settings[key] = settings[key];
        });
        if ((0,_utils_object_utils__WEBPACK_IMPORTED_MODULE_1__.isObjectEqual)(this.settings, previousSettings)) {
            return;
        }
        this.initSimulation(settings);
        this.emit(D3SimulatorEngineEventType.SETTINGS_UPDATE, { settings: this.settings });
        this.runSimulation({ isUpdatingSettings: true });
    }
    startDragNode() {
        this._isDragging = true;
        if (!this._isStabilizing && this.settings.isPhysicsEnabled) {
            this.activateSimulation();
        }
    }
    dragNode(data) {
        const node = this._nodes[this._nodeIndexByNodeId[data.id]];
        if (!node) {
            return;
        }
        if (!this._isDragging) {
            this.startDragNode();
        }
        node.fx = data.x;
        node.fy = data.y;
        if (!this.settings.isPhysicsEnabled) {
            node.x = data.x;
            node.y = data.y;
            // Notify the client that the node position changed.
            // This is otherwise handled by the simulation tick if physics is enabled.
            this.emit(D3SimulatorEngineEventType.NODE_DRAG, { nodes: this._nodes, edges: this._edges });
        }
    }
    endDragNode(data) {
        this._isDragging = false;
        this.simulation.alphaTarget(0);
        const node = this._nodes[this._nodeIndexByNodeId[data.id]];
        if (node && this.settings.isPhysicsEnabled) {
            releaseNode(node);
        }
    }
    // Re-heat simulation.
    // This does not count as "stabilization" and won't emit any progress.
    activateSimulation() {
        if (this.settings.isPhysicsEnabled) {
            this.simulation.alphaTarget(this.settings.alpha.alphaTarget).restart();
            this.releaseNodes();
        }
    }
    fixDefinedNodes(data) {
        // Treat nodes that have existing coordinates as "fixed".
        for (let i = 0; i < data.nodes.length; i++) {
            if (data.nodes[i].x !== null && data.nodes[i].x !== undefined) {
                data.nodes[i].fx = data.nodes[i].x;
            }
            if (data.nodes[i].y !== null && data.nodes[i].y !== undefined) {
                data.nodes[i].fy = data.nodes[i].y;
            }
        }
        return data;
    }
    addData(data) {
        data = this.fixDefinedNodes(data);
        this._nodes.concat(data.nodes);
        this._edges.concat(data.edges);
        this.setNodeIndexByNodeId();
    }
    clearData() {
        this._nodes = [];
        this._edges = [];
        this.setNodeIndexByNodeId();
    }
    setData(data) {
        data = this.fixDefinedNodes(data);
        this.clearData();
        this.addData(data);
    }
    updateData(data) {
        data = this.fixDefinedNodes(data);
        // Keep existing nodes along with their (x, y, fx, fy) coordinates to avoid
        // rearranging the graph layout.
        // These nodes should not be reloaded into the array because the D3 simulation
        // will assign to them completely new coordinates, effectively restarting the animation.
        const newNodeIds = new Set(data.nodes.map((node) => node.id));
        // Remove old nodes that aren't present in the new data.
        const oldNodes = this._nodes.filter((node) => newNodeIds.has(node.id));
        const newNodes = data.nodes.filter((node) => this._nodeIndexByNodeId[node.id] === undefined);
        this._nodes = [...oldNodes, ...newNodes];
        this.setNodeIndexByNodeId();
        // Only keep new links and discard all old links.
        // Old links won't work as some discrepancies arise between the D3 index property
        // and Memgraph's `id` property which affects the source->target mapping.
        this._edges = data.edges;
        // Update simulation with new data.
        this.simulation.nodes(this._nodes);
        this.linkForce.links(this._edges);
    }
    simulate() {
        // Update simulation with new data.
        this.simulation.nodes(this._nodes);
        this.linkForce.links(this._edges);
        // Run simulation "physics".
        this.runSimulation();
        if (!this.settings.isPhysicsEnabled) {
            this.fixNodes();
        }
    }
    startSimulation(data) {
        this.setData(data);
        // Update simulation with new data.
        this.simulation.nodes(this._nodes);
        this.linkForce.links(this._edges);
        // Run simulation "physics".
        this.runSimulation();
    }
    updateSimulation(data) {
        // To avoid rearranging the graph layout during node expand/collapse/hide,
        // it is necessary to keep existing nodes along with their (x, y) coordinates.
        // These nodes should not be reloaded into the array because the D3 simulation
        // will assign to them completely new coordinates, effectively restarting the animation.
        const newNodeIds = new Set(data.nodes.map((node) => node.id));
        // const newNodes = data.nodes.filter((node) => !this.nodeIdentities.has(node.id));
        const newNodes = data.nodes.filter((node) => this._nodeIndexByNodeId[node.id] === undefined);
        const oldNodes = this._nodes.filter((node) => newNodeIds.has(node.id));
        if (!this.settings.isPhysicsEnabled) {
            oldNodes.forEach((node) => fixNode(node));
        }
        // Remove old nodes that aren't present in the new data.
        this._nodes = [...oldNodes, ...newNodes];
        this.setNodeIndexByNodeId();
        // Only keep new links and discard all old links.
        // Old links won't work as some discrepancies arise between the D3 index property
        // and Memgraph's `id` property which affects the source->target mapping.
        this._edges = data.edges;
        // Update simulation with new data.
        this.simulation.nodes(this._nodes);
        this.linkForce.links(this._edges);
        // If there are no new nodes, there is no need for the simulation
        if (!this.settings.isPhysicsEnabled && !newNodes.length) {
            this.emit(D3SimulatorEngineEventType.SIMULATION_END, { nodes: this._nodes, edges: this._edges });
            return;
        }
        // Run simulation "physics".
        this.runSimulation({ isUpdatingSettings: true });
    }
    stopSimulation() {
        this.simulation.stop();
        this._nodes = [];
        this._edges = [];
        this.setNodeIndexByNodeId();
        this.simulation.nodes();
        this.linkForce.links();
    }
    initSimulation(settings) {
        var _a, _b, _c, _d;
        if (settings.alpha) {
            this.simulation
                .alpha(settings.alpha.alpha)
                .alphaMin(settings.alpha.alphaMin)
                .alphaDecay(settings.alpha.alphaDecay)
                .alphaTarget(settings.alpha.alphaTarget);
        }
        if (settings.links) {
            this.linkForce.distance(settings.links.distance).iterations(settings.links.iterations);
        }
        if (settings.collision) {
            const collision = (0,d3_force__WEBPACK_IMPORTED_MODULE_4__["default"])()
                .radius(settings.collision.radius)
                .strength(settings.collision.strength)
                .iterations(settings.collision.iterations);
            this.simulation.force('collide', collision);
        }
        if (settings.collision === null) {
            this.simulation.force('collide', null);
        }
        if (settings.manyBody) {
            const manyBody = (0,d3_force__WEBPACK_IMPORTED_MODULE_5__["default"])()
                .strength(settings.manyBody.strength)
                .theta(settings.manyBody.theta)
                .distanceMin(settings.manyBody.distanceMin)
                .distanceMax(settings.manyBody.distanceMax);
            this.simulation.force('charge', manyBody);
        }
        if (settings.manyBody === null) {
            this.simulation.force('charge', null);
        }
        if ((_a = settings.positioning) === null || _a === void 0 ? void 0 : _a.forceY) {
            const positioningForceX = (0,d3_force__WEBPACK_IMPORTED_MODULE_6__["default"])(settings.positioning.forceX.x).strength(settings.positioning.forceX.strength);
            this.simulation.force('x', positioningForceX);
        }
        if (((_b = settings.positioning) === null || _b === void 0 ? void 0 : _b.forceX) === null) {
            this.simulation.force('x', null);
        }
        if ((_c = settings.positioning) === null || _c === void 0 ? void 0 : _c.forceY) {
            const positioningForceY = (0,d3_force__WEBPACK_IMPORTED_MODULE_7__["default"])(settings.positioning.forceY.y).strength(settings.positioning.forceY.strength);
            this.simulation.force('y', positioningForceY);
        }
        if (((_d = settings.positioning) === null || _d === void 0 ? void 0 : _d.forceY) === null) {
            this.simulation.force('y', null);
        }
        if (settings.centering) {
            const centering = (0,d3_force__WEBPACK_IMPORTED_MODULE_8__["default"])(settings.centering.x, settings.centering.y).strength(settings.centering.strength);
            this.simulation.force('center', centering);
        }
        if (settings.centering === null) {
            this.simulation.force('center', null);
        }
    }
    // This is a blocking action - the user will not be able to interact with the graph
    // during the simulation process.
    runSimulation(options) {
        if (this._isStabilizing) {
            return;
        }
        if (this.settings.isPhysicsEnabled || (options === null || options === void 0 ? void 0 : options.isUpdatingSettings)) {
            this.releaseNodes();
        }
        this.emit(D3SimulatorEngineEventType.SIMULATION_START, undefined);
        this._isStabilizing = true;
        this.simulation.alpha(this.settings.alpha.alpha).alphaTarget(this.settings.alpha.alphaTarget).stop();
        const totalSimulationSteps = Math.ceil(Math.log(this.settings.alpha.alphaMin) / Math.log(1 - this.settings.alpha.alphaDecay));
        let lastProgress = -1;
        for (let i = 0; i < totalSimulationSteps; i++) {
            const currentProgress = Math.round((i * 100) / totalSimulationSteps);
            // Emit progress maximum of 100 times (every percent)
            if (currentProgress > lastProgress) {
                lastProgress = currentProgress;
                this.emit(D3SimulatorEngineEventType.SIMULATION_PROGRESS, {
                    nodes: this._nodes,
                    edges: this._edges,
                    progress: currentProgress / 100,
                });
            }
            this.simulation.tick();
        }
        if (!this.settings.isPhysicsEnabled) {
            this.fixNodes();
        }
        this._isStabilizing = false;
        this.emit(D3SimulatorEngineEventType.SIMULATION_END, { nodes: this._nodes, edges: this._edges });
    }
    setNodeIndexByNodeId() {
        this._nodeIndexByNodeId = {};
        for (let i = 0; i < this._nodes.length; i++) {
            this._nodeIndexByNodeId[this._nodes[i].id] = i;
        }
    }
    fixNodes(nodes) {
        if (!nodes) {
            nodes = this._nodes;
        }
        for (let i = 0; i < nodes.length; i++) {
            fixNode(this._nodes[i]);
        }
    }
    releaseNodes(nodes) {
        if (!nodes) {
            nodes = this._nodes;
        }
        for (let i = 0; i < nodes.length; i++) {
            releaseNode(this._nodes[i]);
        }
    }
}
const fixNode = (node) => {
    // fx and fy fix the node position in the D3 simulation.
    node.fx = node.x;
    node.fy = node.y;
};
const releaseNode = (node) => {
    node.fx = null;
    node.fy = null;
};


/***/ }),

/***/ "./src/simulator/types/web-worker-simulator/message/worker-input.ts":
/*!**************************************************************************!*\
  !*** ./src/simulator/types/web-worker-simulator/message/worker-input.ts ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WorkerInputType": () => (/* binding */ WorkerInputType)
/* harmony export */ });
// Messages are objects going into the simulation worker.
// They can be thought of similar to requests.
// (not quite as there is no immediate response to a request)
var WorkerInputType;
(function (WorkerInputType) {
    // Set node and edge data without simulating
    WorkerInputType["SetData"] = "Set Data";
    WorkerInputType["AddData"] = "Add Data";
    WorkerInputType["UpdateData"] = "Update Data";
    WorkerInputType["ClearData"] = "Clear Data";
    // Simulation message types
    WorkerInputType["Simulate"] = "Simulate";
    WorkerInputType["ActivateSimulation"] = "Activate Simulation";
    WorkerInputType["StartSimulation"] = "Start Simulation";
    WorkerInputType["UpdateSimulation"] = "Update Simulation";
    WorkerInputType["StopSimulation"] = "Stop Simulation";
    // Node dragging message types
    WorkerInputType["StartDragNode"] = "Start Drag Node";
    WorkerInputType["DragNode"] = "Drag Node";
    WorkerInputType["EndDragNode"] = "End Drag Node";
    WorkerInputType["FixNodes"] = "Fix Nodes";
    WorkerInputType["ReleaseNodes"] = "Release Nodes";
    // Settings and special params
    WorkerInputType["SetSettings"] = "Set Settings";
})(WorkerInputType || (WorkerInputType = {}));


/***/ }),

/***/ "./src/simulator/types/web-worker-simulator/message/worker-output.ts":
/*!***************************************************************************!*\
  !*** ./src/simulator/types/web-worker-simulator/message/worker-output.ts ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WorkerOutputType": () => (/* binding */ WorkerOutputType)
/* harmony export */ });
var WorkerOutputType;
(function (WorkerOutputType) {
    WorkerOutputType["SIMULATION_START"] = "simulation-start";
    WorkerOutputType["SIMULATION_PROGRESS"] = "simulation-progress";
    WorkerOutputType["SIMULATION_END"] = "simulation-end";
    WorkerOutputType["NODE_DRAG"] = "node-drag";
    WorkerOutputType["NODE_DRAG_END"] = "node-drag-end";
    WorkerOutputType["SETTINGS_UPDATE"] = "settings-update";
})(WorkerOutputType || (WorkerOutputType = {}));


/***/ }),

/***/ "./src/simulator/types/web-worker-simulator/process.worker.ts":
/*!********************************************************************!*\
  !*** ./src/simulator/types/web-worker-simulator/process.worker.ts ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _engine_d3_simulator_engine__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../engine/d3-simulator-engine */ "./src/simulator/engine/d3-simulator-engine.ts");
/* harmony import */ var _message_worker_input__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./message/worker-input */ "./src/simulator/types/web-worker-simulator/message/worker-input.ts");
/* harmony import */ var _message_worker_output__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./message/worker-output */ "./src/simulator/types/web-worker-simulator/message/worker-output.ts");
// / <reference lib="webworker" />



const simulator = new _engine_d3_simulator_engine__WEBPACK_IMPORTED_MODULE_0__.D3SimulatorEngine();
const emitToMain = (message) => {
    // @ts-ignore Web worker postMessage is a global function
    postMessage(message);
};
simulator.on(_engine_d3_simulator_engine__WEBPACK_IMPORTED_MODULE_0__.D3SimulatorEngineEventType.TICK, (data) => {
    emitToMain({ type: _message_worker_output__WEBPACK_IMPORTED_MODULE_2__.WorkerOutputType.NODE_DRAG, data });
});
simulator.on(_engine_d3_simulator_engine__WEBPACK_IMPORTED_MODULE_0__.D3SimulatorEngineEventType.END, (data) => {
    emitToMain({ type: _message_worker_output__WEBPACK_IMPORTED_MODULE_2__.WorkerOutputType.NODE_DRAG_END, data });
});
simulator.on(_engine_d3_simulator_engine__WEBPACK_IMPORTED_MODULE_0__.D3SimulatorEngineEventType.SIMULATION_START, () => {
    emitToMain({ type: _message_worker_output__WEBPACK_IMPORTED_MODULE_2__.WorkerOutputType.SIMULATION_START });
});
simulator.on(_engine_d3_simulator_engine__WEBPACK_IMPORTED_MODULE_0__.D3SimulatorEngineEventType.SIMULATION_PROGRESS, (data) => {
    emitToMain({ type: _message_worker_output__WEBPACK_IMPORTED_MODULE_2__.WorkerOutputType.SIMULATION_PROGRESS, data });
});
simulator.on(_engine_d3_simulator_engine__WEBPACK_IMPORTED_MODULE_0__.D3SimulatorEngineEventType.SIMULATION_END, (data) => {
    emitToMain({ type: _message_worker_output__WEBPACK_IMPORTED_MODULE_2__.WorkerOutputType.SIMULATION_END, data });
});
simulator.on(_engine_d3_simulator_engine__WEBPACK_IMPORTED_MODULE_0__.D3SimulatorEngineEventType.NODE_DRAG, (data) => {
    // Notify the client that the node position changed.
    // This is otherwise handled by the simulation tick if physics is enabled.
    emitToMain({ type: _message_worker_output__WEBPACK_IMPORTED_MODULE_2__.WorkerOutputType.NODE_DRAG, data });
});
simulator.on(_engine_d3_simulator_engine__WEBPACK_IMPORTED_MODULE_0__.D3SimulatorEngineEventType.SETTINGS_UPDATE, (data) => {
    emitToMain({ type: _message_worker_output__WEBPACK_IMPORTED_MODULE_2__.WorkerOutputType.SETTINGS_UPDATE, data });
});
addEventListener('message', ({ data }) => {
    switch (data.type) {
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.ActivateSimulation: {
            simulator.activateSimulation();
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.SetData: {
            simulator.setData(data.data);
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.AddData: {
            simulator.addData(data.data);
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.UpdateData: {
            simulator.updateData(data.data);
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.ClearData: {
            simulator.clearData();
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.Simulate: {
            simulator.simulate();
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.StartSimulation: {
            simulator.startSimulation(data.data);
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.UpdateSimulation: {
            simulator.updateSimulation(data.data);
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.StopSimulation: {
            simulator.stopSimulation();
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.StartDragNode: {
            simulator.startDragNode();
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.DragNode: {
            simulator.dragNode(data.data);
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.FixNodes: {
            simulator.fixNodes(data.data.nodes);
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.ReleaseNodes: {
            simulator.releaseNodes(data.data.nodes);
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.EndDragNode: {
            simulator.endDragNode(data.data);
            break;
        }
        case _message_worker_input__WEBPACK_IMPORTED_MODULE_1__.WorkerInputType.SetSettings: {
            simulator.setSettings(data.data);
            break;
        }
    }
});


/***/ }),

/***/ "./src/utils/emitter.utils.ts":
/*!************************************!*\
  !*** ./src/utils/emitter.utils.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Emitter": () => (/* binding */ Emitter)
/* harmony export */ });
class Emitter {
    constructor() {
        this._listeners = new Map();
    }
    /**
     * Adds a one-time listener function for the event named eventName. The next time eventName is
     * triggered, this listener is removed and then invoked.
     *
     * @see {@link https://nodejs.org/api/events.html#emitteronceeventname-listener}
     * @param {IEventKey} eventName Event name
     * @param {IEventReceiver} func Event function
     * @return {IEmitter} Reference to the EventEmitter, so that calls can be chained
     */
    once(eventName, func) {
        const newListener = {
            callable: func,
            isOnce: true,
        };
        const listeners = this._listeners.get(eventName);
        if (listeners) {
            listeners.push(newListener);
        }
        else {
            this._listeners.set(eventName, [newListener]);
        }
        return this;
    }
    /**
     * Adds the listener function to the end of the listeners array for the event named eventName.
     * No checks are made to see if the listener has already been added. Multiple calls passing
     * the same combination of eventName and listener will result in the listener being added,
     * and called, multiple times.
     *
     * @see {@link https://nodejs.org/api/events.html#emitteroneventname-listener}
     * @param {IEventKey} eventName Event name
     * @param {IEventReceiver} func Event function
     * @return {IEmitter} Reference to the EventEmitter, so that calls can be chained
     */
    on(eventName, func) {
        const newListener = {
            callable: func,
        };
        const listeners = this._listeners.get(eventName);
        if (listeners) {
            listeners.push(newListener);
        }
        else {
            this._listeners.set(eventName, [newListener]);
        }
        return this;
    }
    /**
     * Removes the specified listener from the listener array for the event named eventName.
     *
     * @see {@link https://nodejs.org/api/events.html#emitterremovelistenereventname-listener}
     * @param {IEventKey} eventName Event name
     * @param {IEventReceiver} func Event function
     * @return {IEmitter} Reference to the EventEmitter, so that calls can be chained
     */
    off(eventName, func) {
        const listeners = this._listeners.get(eventName);
        if (listeners) {
            const filteredListeners = listeners.filter((listener) => listener.callable !== func);
            this._listeners.set(eventName, filteredListeners);
        }
        return this;
    }
    /**
     * Synchronously calls each of the listeners registered for the event named eventName,
     * in the order they were registered, passing the supplied arguments to each.
     * Returns true if the event had listeners, false otherwise.
     *
     * @param {IEventKey} eventName Event name
     * @param {any} params Event parameters
     *
     * @return {boolean} True if the event had listeners, false otherwise
     */
    emit(eventName, params) {
        const listeners = this._listeners.get(eventName);
        if (!listeners || listeners.length === 0) {
            return false;
        }
        let hasOnceListener = false;
        for (let i = 0; i < listeners.length; i++) {
            if (listeners[i].isOnce) {
                hasOnceListener = true;
            }
            listeners[i].callable(params);
        }
        if (hasOnceListener) {
            const filteredListeners = listeners.filter((listener) => !listener.isOnce);
            this._listeners.set(eventName, filteredListeners);
        }
        return true;
    }
    /**
     * Returns an array listing the events for which the emitter has registered listeners.
     *
     * @see {@link https://nodejs.org/api/events.html#emittereventnames}
     * @return {IEventKey[]} Event names with registered listeners
     */
    eventNames() {
        return [...this._listeners.keys()];
    }
    /**
     * Returns the number of listeners listening to the event named eventName.
     *
     * @see {@link https://nodejs.org/api/events.html#emitterlistenercounteventname}
     * @param {IEventKey} eventName Event name
     * @return {number} Number of listeners listening to the event name
     */
    listenerCount(eventName) {
        const listeners = this._listeners.get(eventName);
        return listeners ? listeners.length : 0;
    }
    /**
     * Returns a copy of the array of listeners for the event named eventName.
     *
     * @see {@link https://nodejs.org/api/events.html#emitterlistenerseventname}
     * @param {IEventKey} eventName Event name
     * @return {IEventReceiver[]} Array of listeners for the event name
     */
    listeners(eventName) {
        const listeners = this._listeners.get(eventName);
        if (!listeners) {
            return [];
        }
        return listeners.map((listener) => listener.callable);
    }
    /**
     * Alias for emitter.on(eventName, listener).
     *
     * @see {@link https://nodejs.org/api/events.html#emitteraddlistenereventname-listener}
     * @param {IEventKey} eventName Event name
     * @param {IEventReceiver} func Event function
     * @return {IEmitter} Reference to the EventEmitter, so that calls can be chained
     */
    addListener(eventName, func) {
        return this.on(eventName, func);
    }
    /**
     * Alias for emitter.off(eventName, listener).
     *
     * @see {@link https://nodejs.org/api/events.html#emitterremovelistenereventname-listener}
     * @param {IEventKey} eventName Event name
     * @param {IEventReceiver} func Event function
     * @return {IEmitter} Reference to the EventEmitter, so that calls can be chained
     */
    removeListener(eventName, func) {
        return this.off(eventName, func);
    }
    /**
     * Removes all listeners, or those of the specified eventName.
     *
     * @see {@link https://nodejs.org/api/events.html#emitterremovealllistenerseventname}
     * @param {IEventKey} eventName Event name
     * @return {IEmitter} Reference to the EventEmitter, so that calls can be chained
     */
    removeAllListeners(eventName) {
        if (eventName) {
            this._listeners.delete(eventName);
        }
        else {
            this._listeners.clear();
        }
        return this;
    }
}


/***/ }),

/***/ "./src/utils/object.utils.ts":
/*!***********************************!*\
  !*** ./src/utils/object.utils.ts ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "copyObject": () => (/* binding */ copyObject),
/* harmony export */   "isObjectEqual": () => (/* binding */ isObjectEqual)
/* harmony export */ });
/* harmony import */ var _type_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./type.utils */ "./src/utils/type.utils.ts");

/**
 * Creates a new deep copy of the received object. Dates, arrays and
 * plain objects will be created as new objects (new reference).
 *
 * @param {any} obj Object
 * @return {any} Deep copied object
 */
const copyObject = (obj) => {
    if ((0,_type_utils__WEBPACK_IMPORTED_MODULE_0__.isDate)(obj)) {
        return copyDate(obj);
    }
    if ((0,_type_utils__WEBPACK_IMPORTED_MODULE_0__.isArray)(obj)) {
        return copyArray(obj);
    }
    if ((0,_type_utils__WEBPACK_IMPORTED_MODULE_0__.isPlainObject)(obj)) {
        return copyPlainObject(obj);
    }
    // It is a primitive, function or a custom class
    return obj;
};
/**
 * Checks if two objects are equal by value. It does deep checking for
 * values within arrays or plain objects. Equality for anything that is
 * not a Date, Array, or a plain object will be checked as `a === b`.
 *
 * @param {any} obj1 Object
 * @param {any} obj2 Object
 * @return {boolean} True if objects are deeply equal, otherwise false
 */
const isObjectEqual = (obj1, obj2) => {
    const isDate1 = (0,_type_utils__WEBPACK_IMPORTED_MODULE_0__.isDate)(obj1);
    const isDate2 = (0,_type_utils__WEBPACK_IMPORTED_MODULE_0__.isDate)(obj2);
    if ((isDate1 && !isDate2) || (!isDate1 && isDate2)) {
        return false;
    }
    if (isDate1 && isDate2) {
        return obj1.getTime() === obj2.getTime();
    }
    const isArray1 = (0,_type_utils__WEBPACK_IMPORTED_MODULE_0__.isArray)(obj1);
    const isArray2 = (0,_type_utils__WEBPACK_IMPORTED_MODULE_0__.isArray)(obj2);
    if ((isArray1 && !isArray2) || (!isArray1 && isArray2)) {
        return false;
    }
    if (isArray1 && isArray2) {
        if (obj1.length !== obj2.length) {
            return false;
        }
        return obj1.every((value, index) => {
            return isObjectEqual(value, obj2[index]);
        });
    }
    const isObject1 = (0,_type_utils__WEBPACK_IMPORTED_MODULE_0__.isPlainObject)(obj1);
    const isObject2 = (0,_type_utils__WEBPACK_IMPORTED_MODULE_0__.isPlainObject)(obj2);
    if ((isObject1 && !isObject2) || (!isObject1 && isObject2)) {
        return false;
    }
    if (isObject1 && isObject2) {
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        if (!isObjectEqual(keys1, keys2)) {
            return false;
        }
        return keys1.every((key) => {
            return isObjectEqual(obj1[key], obj2[key]);
        });
    }
    return obj1 === obj2;
};
/**
 * Copies date object into a new date object.
 *
 * @param {Date} date Date
 * @return {Date} Date object copy
 */
const copyDate = (date) => {
    return new Date(date);
};
/**
 * Deep copies an array into a new array. Array values will
 * be deep copied too.
 *
 * @param {Array} array Array
 * @return {Array} Deep copied array
 */
const copyArray = (array) => {
    return array.map((value) => copyObject(value));
};
/**
 * Deep copies a plain object into a new plain object. Object
 * values will be deep copied too.
 *
 * @param {Record} obj Object
 * @return {Record} Deep copied object
 */
const copyPlainObject = (obj) => {
    const newObject = {};
    Object.keys(obj).forEach((key) => {
        newObject[key] = copyObject(obj[key]);
    });
    return newObject;
};


/***/ }),

/***/ "./src/utils/type.utils.ts":
/*!*********************************!*\
  !*** ./src/utils/type.utils.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "isArray": () => (/* binding */ isArray),
/* harmony export */   "isBoolean": () => (/* binding */ isBoolean),
/* harmony export */   "isDate": () => (/* binding */ isDate),
/* harmony export */   "isFunction": () => (/* binding */ isFunction),
/* harmony export */   "isNull": () => (/* binding */ isNull),
/* harmony export */   "isNumber": () => (/* binding */ isNumber),
/* harmony export */   "isPlainObject": () => (/* binding */ isPlainObject),
/* harmony export */   "isString": () => (/* binding */ isString)
/* harmony export */ });
/**
 * Type check for string values.
 *
 * @param {any} value Any value
 * @return {boolean} True if it is a string, false otherwise
 */
const isString = (value) => {
    return typeof value === 'string';
};
/**
 * Type check for number values.
 *
 * @param {any} value Any value
 * @return {boolean} True if it is a number, false otherwise
 */
const isNumber = (value) => {
    return typeof value === 'number';
};
/**
 * Type check for boolean values.
 *
 * @param {any} value Any value
 * @return {boolean} True if it is a boolean, false otherwise
 */
const isBoolean = (value) => {
    return typeof value === 'boolean';
};
/**
 * Type check for Date values.
 *
 * @param {any} value Any value
 * @return {boolean} True if it is a Date, false otherwise
 */
const isDate = (value) => {
    return value instanceof Date;
};
/**
 * Type check for Array values. Alias for `Array.isArray`.
 *
 * @param {any} value Any value
 * @return {boolean} True if it is an Array, false otherwise
 */
const isArray = (value) => {
    return Array.isArray(value);
};
/**
 * Type check for plain object values: { [key]: value }
 *
 * @param {any} value Any value
 * @return {boolean} True if it is a plain object, false otherwise
 */
const isPlainObject = (value) => {
    return value !== null && typeof value === 'object' && value.constructor.name === 'Object';
};
/**
 * Type check for null values.
 *
 * @param {any} value Any value
 * @return {boolean} True if it is a null, false otherwise
 */
const isNull = (value) => {
    return value === null;
};
/**
 * Type check for Function values.
 *
 * @param {any} value Any value
 * @return {boolean} True if it is a Function, false otherwise
 */
const isFunction = (value) => {
    return typeof value === 'function';
};


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/******/ 	// the startup function
/******/ 	__webpack_require__.x = () => {
/******/ 		// Load entry module and return exports
/******/ 		// This entry module depends on other loaded chunks and execution need to be delayed
/******/ 		var __webpack_exports__ = __webpack_require__.O(undefined, ["vendors-node_modules_d3-force_src_center_js-node_modules_d3-force_src_collide_js-node_modules-04327d"], () => (__webpack_require__("./src/simulator/types/web-worker-simulator/process.worker.ts")))
/******/ 		__webpack_exports__ = __webpack_require__.O(__webpack_exports__);
/******/ 		return __webpack_exports__;
/******/ 	};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/chunk loaded */
/******/ 	(() => {
/******/ 		var deferred = [];
/******/ 		__webpack_require__.O = (result, chunkIds, fn, priority) => {
/******/ 			if(chunkIds) {
/******/ 				priority = priority || 0;
/******/ 				for(var i = deferred.length; i > 0 && deferred[i - 1][2] > priority; i--) deferred[i] = deferred[i - 1];
/******/ 				deferred[i] = [chunkIds, fn, priority];
/******/ 				return;
/******/ 			}
/******/ 			var notFulfilled = Infinity;
/******/ 			for (var i = 0; i < deferred.length; i++) {
/******/ 				var [chunkIds, fn, priority] = deferred[i];
/******/ 				var fulfilled = true;
/******/ 				for (var j = 0; j < chunkIds.length; j++) {
/******/ 					if ((priority & 1 === 0 || notFulfilled >= priority) && Object.keys(__webpack_require__.O).every((key) => (__webpack_require__.O[key](chunkIds[j])))) {
/******/ 						chunkIds.splice(j--, 1);
/******/ 					} else {
/******/ 						fulfilled = false;
/******/ 						if(priority < notFulfilled) notFulfilled = priority;
/******/ 					}
/******/ 				}
/******/ 				if(fulfilled) {
/******/ 					deferred.splice(i--, 1)
/******/ 					var r = fn();
/******/ 					if (r !== undefined) result = r;
/******/ 				}
/******/ 			}
/******/ 			return result;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks and sibling chunks for the entrypoint
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames not based on template
/******/ 			if (chunkId === "vendors-node_modules_d3-force_src_center_js-node_modules_d3-force_src_collide_js-node_modules-04327d") return "orb.worker.vendor.js";
/******/ 			// return url for filenames based on template
/******/ 			return undefined;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		var scriptUrl;
/******/ 		if (__webpack_require__.g.importScripts) scriptUrl = __webpack_require__.g.location + "";
/******/ 		var document = __webpack_require__.g.document;
/******/ 		if (!scriptUrl && document) {
/******/ 			if (document.currentScript)
/******/ 				scriptUrl = document.currentScript.src;
/******/ 			if (!scriptUrl) {
/******/ 				var scripts = document.getElementsByTagName("script");
/******/ 				if(scripts.length) scriptUrl = scripts[scripts.length - 1].src
/******/ 			}
/******/ 		}
/******/ 		// When supporting browsers where an automatic publicPath is not supported you must specify an output.publicPath manually via configuration
/******/ 		// or pass an empty string ("") and set the __webpack_public_path__ variable from your code to use your own logic.
/******/ 		if (!scriptUrl) throw new Error("Automatic publicPath is not supported in this browser");
/******/ 		scriptUrl = scriptUrl.replace(/#.*$/, "").replace(/\?.*$/, "").replace(/\/[^\/]+$/, "/");
/******/ 		__webpack_require__.p = scriptUrl;
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/importScripts chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded chunks
/******/ 		// "1" means "already loaded"
/******/ 		var installedChunks = {
/******/ 			"process.worker": 1
/******/ 		};
/******/ 		
/******/ 		// importScripts chunk loading
/******/ 		var installChunk = (data) => {
/******/ 			var [chunkIds, moreModules, runtime] = data;
/******/ 			for(var moduleId in moreModules) {
/******/ 				if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 					__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 				}
/******/ 			}
/******/ 			if(runtime) runtime(__webpack_require__);
/******/ 			while(chunkIds.length)
/******/ 				installedChunks[chunkIds.pop()] = 1;
/******/ 			parentChunkLoadingFunction(data);
/******/ 		};
/******/ 		__webpack_require__.f.i = (chunkId, promises) => {
/******/ 			// "1" is the signal for "already loaded"
/******/ 			if(!installedChunks[chunkId]) {
/******/ 				if(true) { // all chunks have JS
/******/ 					importScripts(__webpack_require__.p + __webpack_require__.u(chunkId));
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 		
/******/ 		var chunkLoadingGlobal = self["webpackChunkOrb"] = self["webpackChunkOrb"] || [];
/******/ 		var parentChunkLoadingFunction = chunkLoadingGlobal.push.bind(chunkLoadingGlobal);
/******/ 		chunkLoadingGlobal.push = installChunk;
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/startup chunk dependencies */
/******/ 	(() => {
/******/ 		var next = __webpack_require__.x;
/******/ 		__webpack_require__.x = () => {
/******/ 			return __webpack_require__.e("vendors-node_modules_d3-force_src_center_js-node_modules_d3-force_src_collide_js-node_modules-04327d").then(next);
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// run startup
/******/ 	var __webpack_exports__ = __webpack_require__.x();
/******/ 	
/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Ozs7O1dDM0JBO1dBQ0E7V0FDQTtXQUNBO1dBQ0EseUNBQXlDLHdDQUF3QztXQUNqRjtXQUNBO1dBQ0E7Ozs7O1dDUEE7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQSxFQUFFO1dBQ0Y7Ozs7O1dDUkE7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7Ozs7O1dDTkE7V0FDQTtXQUNBO1dBQ0E7V0FDQSxHQUFHO1dBQ0g7V0FDQTtXQUNBLENBQUM7Ozs7O1dDUEQ7Ozs7O1dDQUE7V0FDQTtXQUNBO1dBQ0EsdURBQXVELGlCQUFpQjtXQUN4RTtXQUNBLGdEQUFnRCxhQUFhO1dBQzdEOzs7OztXQ05BO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBOzs7OztXQ2ZBOztXQUVBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7O1dBRUE7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQSxhQUFhO1dBQ2I7V0FDQTtXQUNBO1dBQ0E7O1dBRUE7V0FDQTtXQUNBOztXQUVBOztXQUVBOzs7OztXQ3BDQTtXQUNBO1dBQ0E7V0FDQTs7Ozs7VUVIQTtVQUNBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vT3JiL3dlYnBhY2svdW5pdmVyc2FsTW9kdWxlRGVmaW5pdGlvbiIsIndlYnBhY2s6Ly9PcmIvLi9zcmMvc2ltdWxhdG9yL2VuZ2luZS9kMy1zaW11bGF0b3ItZW5naW5lLnRzIiwid2VicGFjazovL09yYi8uL3NyYy9zaW11bGF0b3IvdHlwZXMvd2ViLXdvcmtlci1zaW11bGF0b3IvbWVzc2FnZS93b3JrZXItaW5wdXQudHMiLCJ3ZWJwYWNrOi8vT3JiLy4vc3JjL3NpbXVsYXRvci90eXBlcy93ZWItd29ya2VyLXNpbXVsYXRvci9tZXNzYWdlL3dvcmtlci1vdXRwdXQudHMiLCJ3ZWJwYWNrOi8vT3JiLy4vc3JjL3NpbXVsYXRvci90eXBlcy93ZWItd29ya2VyLXNpbXVsYXRvci9wcm9jZXNzLndvcmtlci50cyIsIndlYnBhY2s6Ly9PcmIvLi9zcmMvdXRpbHMvZW1pdHRlci51dGlscy50cyIsIndlYnBhY2s6Ly9PcmIvLi9zcmMvdXRpbHMvb2JqZWN0LnV0aWxzLnRzIiwid2VicGFjazovL09yYi8uL3NyYy91dGlscy90eXBlLnV0aWxzLnRzIiwid2VicGFjazovL09yYi93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9PcmIvd2VicGFjay9ydW50aW1lL2NodW5rIGxvYWRlZCIsIndlYnBhY2s6Ly9PcmIvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL09yYi93ZWJwYWNrL3J1bnRpbWUvZW5zdXJlIGNodW5rIiwid2VicGFjazovL09yYi93ZWJwYWNrL3J1bnRpbWUvZ2V0IGphdmFzY3JpcHQgY2h1bmsgZmlsZW5hbWUiLCJ3ZWJwYWNrOi8vT3JiL3dlYnBhY2svcnVudGltZS9nbG9iYWwiLCJ3ZWJwYWNrOi8vT3JiL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vT3JiL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vT3JiL3dlYnBhY2svcnVudGltZS9wdWJsaWNQYXRoIiwid2VicGFjazovL09yYi93ZWJwYWNrL3J1bnRpbWUvaW1wb3J0U2NyaXB0cyBjaHVuayBsb2FkaW5nIiwid2VicGFjazovL09yYi93ZWJwYWNrL3J1bnRpbWUvc3RhcnR1cCBjaHVuayBkZXBlbmRlbmNpZXMiLCJ3ZWJwYWNrOi8vT3JiL3dlYnBhY2svYmVmb3JlLXN0YXJ0dXAiLCJ3ZWJwYWNrOi8vT3JiL3dlYnBhY2svc3RhcnR1cCIsIndlYnBhY2s6Ly9PcmIvd2VicGFjay9hZnRlci1zdGFydHVwIl0sInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiB3ZWJwYWNrVW5pdmVyc2FsTW9kdWxlRGVmaW5pdGlvbihyb290LCBmYWN0b3J5KSB7XG5cdGlmKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0Jylcblx0XHRtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcblx0ZWxzZSBpZih0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpXG5cdFx0ZGVmaW5lKFtdLCBmYWN0b3J5KTtcblx0ZWxzZSBpZih0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpXG5cdFx0ZXhwb3J0c1tcIk9yYlwiXSA9IGZhY3RvcnkoKTtcblx0ZWxzZVxuXHRcdHJvb3RbXCJPcmJcIl0gPSBmYWN0b3J5KCk7XG59KShzZWxmLCAoKSA9PiB7XG5yZXR1cm4gIiwiaW1wb3J0IHtcbiAgZm9yY2VDZW50ZXIsXG4gIGZvcmNlQ29sbGlkZSxcbiAgZm9yY2VMaW5rLFxuICBGb3JjZUxpbmssXG4gIGZvcmNlTWFueUJvZHksXG4gIGZvcmNlU2ltdWxhdGlvbixcbiAgZm9yY2VYLFxuICBmb3JjZVksXG4gIFNpbXVsYXRpb24sXG4gIFNpbXVsYXRpb25MaW5rRGF0dW0sXG59IGZyb20gJ2QzLWZvcmNlJztcbmltcG9ydCB7IElQb3NpdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbic7XG5pbXBvcnQgeyBJU2ltdWxhdGlvbk5vZGUsIElTaW11bGF0aW9uRWRnZSB9IGZyb20gJy4uL3NoYXJlZCc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW1pdHRlci51dGlscyc7XG5pbXBvcnQgeyBpc09iamVjdEVxdWFsLCBjb3B5T2JqZWN0IH0gZnJvbSAnLi4vLi4vdXRpbHMvb2JqZWN0LnV0aWxzJztcblxuY29uc3QgTUFOWV9CT0RZX01BWF9ESVNUQU5DRV9UT19MSU5LX0RJU1RBTkNFX1JBVElPID0gMTAwO1xuY29uc3QgREVGQVVMVF9MSU5LX0RJU1RBTkNFID0gMzA7XG5cbmV4cG9ydCBlbnVtIEQzU2ltdWxhdG9yRW5naW5lRXZlbnRUeXBlIHtcbiAgVElDSyA9ICd0aWNrJyxcbiAgRU5EID0gJ2VuZCcsXG4gIFNJTVVMQVRJT05fU1RBUlQgPSAnc2ltdWxhdGlvbi1zdGFydCcsXG4gIFNJTVVMQVRJT05fUFJPR1JFU1MgPSAnc2ltdWxhdGlvbi1wcm9ncmVzcycsXG4gIFNJTVVMQVRJT05fRU5EID0gJ3NpbXVsYXRpb24tZW5kJyxcbiAgTk9ERV9EUkFHID0gJ25vZGUtZHJhZycsXG4gIFNFVFRJTkdTX1VQREFURSA9ICdzZXR0aW5ncy11cGRhdGUnLFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEM1NpbXVsYXRvckVuZ2luZVNldHRpbmdzQWxwaGEge1xuICBhbHBoYTogbnVtYmVyO1xuICBhbHBoYU1pbjogbnVtYmVyO1xuICBhbHBoYURlY2F5OiBudW1iZXI7XG4gIGFscGhhVGFyZ2V0OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUQzU2ltdWxhdG9yRW5naW5lU2V0dGluZ3NDZW50ZXJpbmcge1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgc3RyZW5ndGg6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRDNTaW11bGF0b3JFbmdpbmVTZXR0aW5nc0NvbGxpc2lvbiB7XG4gIHJhZGl1czogbnVtYmVyO1xuICBzdHJlbmd0aDogbnVtYmVyO1xuICBpdGVyYXRpb25zOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUQzU2ltdWxhdG9yRW5naW5lU2V0dGluZ3NMaW5rcyB7XG4gIGRpc3RhbmNlOiBudW1iZXI7XG4gIHN0cmVuZ3RoPzogbnVtYmVyO1xuICBpdGVyYXRpb25zOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUQzU2ltdWxhdG9yRW5naW5lU2V0dGluZ3NNYW55Qm9keSB7XG4gIHN0cmVuZ3RoOiBudW1iZXI7XG4gIHRoZXRhOiBudW1iZXI7XG4gIGRpc3RhbmNlTWluOiBudW1iZXI7XG4gIGRpc3RhbmNlTWF4OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUQzU2ltdWxhdG9yRW5naW5lU2V0dGluZ3NQb3NpdGlvbmluZyB7XG4gIGZvcmNlWDoge1xuICAgIHg6IG51bWJlcjtcbiAgICBzdHJlbmd0aDogbnVtYmVyO1xuICB9O1xuICBmb3JjZVk6IHtcbiAgICB5OiBudW1iZXI7XG4gICAgc3RyZW5ndGg6IG51bWJlcjtcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRDNTaW11bGF0b3JFbmdpbmVTZXR0aW5ncyB7XG4gIGlzUGh5c2ljc0VuYWJsZWQ6IGJvb2xlYW47XG4gIGFscGhhOiBJRDNTaW11bGF0b3JFbmdpbmVTZXR0aW5nc0FscGhhO1xuICBjZW50ZXJpbmc6IElEM1NpbXVsYXRvckVuZ2luZVNldHRpbmdzQ2VudGVyaW5nIHwgbnVsbDtcbiAgY29sbGlzaW9uOiBJRDNTaW11bGF0b3JFbmdpbmVTZXR0aW5nc0NvbGxpc2lvbiB8IG51bGw7XG4gIGxpbmtzOiBJRDNTaW11bGF0b3JFbmdpbmVTZXR0aW5nc0xpbmtzO1xuICBtYW55Qm9keTogSUQzU2ltdWxhdG9yRW5naW5lU2V0dGluZ3NNYW55Qm9keSB8IG51bGw7XG4gIHBvc2l0aW9uaW5nOiBJRDNTaW11bGF0b3JFbmdpbmVTZXR0aW5nc1Bvc2l0aW9uaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IHR5cGUgSUQzU2ltdWxhdG9yRW5naW5lU2V0dGluZ3NVcGRhdGUgPSBQYXJ0aWFsPElEM1NpbXVsYXRvckVuZ2luZVNldHRpbmdzPjtcblxuZXhwb3J0IGNvbnN0IGdldE1hbnlCb2R5TWF4RGlzdGFuY2UgPSAobGlua0Rpc3RhbmNlOiBudW1iZXIpID0+IHtcbiAgY29uc3QgZGlzdGFuY2UgPSBsaW5rRGlzdGFuY2UgPiAwID8gbGlua0Rpc3RhbmNlIDogMTtcbiAgcmV0dXJuIGRpc3RhbmNlICogTUFOWV9CT0RZX01BWF9ESVNUQU5DRV9UT19MSU5LX0RJU1RBTkNFX1JBVElPO1xufTtcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IElEM1NpbXVsYXRvckVuZ2luZVNldHRpbmdzID0ge1xuICBpc1BoeXNpY3NFbmFibGVkOiBmYWxzZSxcbiAgYWxwaGE6IHtcbiAgICBhbHBoYTogMSxcbiAgICBhbHBoYU1pbjogMC4wMDEsXG4gICAgYWxwaGFEZWNheTogMC4wMjI4LFxuICAgIGFscGhhVGFyZ2V0OiAwLjEsXG4gIH0sXG4gIGNlbnRlcmluZzoge1xuICAgIHg6IDAsXG4gICAgeTogMCxcbiAgICBzdHJlbmd0aDogMSxcbiAgfSxcbiAgY29sbGlzaW9uOiB7XG4gICAgcmFkaXVzOiAxNSxcbiAgICBzdHJlbmd0aDogMSxcbiAgICBpdGVyYXRpb25zOiAxLFxuICB9LFxuICBsaW5rczoge1xuICAgIGRpc3RhbmNlOiBERUZBVUxUX0xJTktfRElTVEFOQ0UsXG4gICAgc3RyZW5ndGg6IHVuZGVmaW5lZCxcbiAgICBpdGVyYXRpb25zOiAxLFxuICB9LFxuICBtYW55Qm9keToge1xuICAgIHN0cmVuZ3RoOiAtMTAwLFxuICAgIHRoZXRhOiAwLjksXG4gICAgZGlzdGFuY2VNaW46IDAsXG4gICAgZGlzdGFuY2VNYXg6IGdldE1hbnlCb2R5TWF4RGlzdGFuY2UoREVGQVVMVF9MSU5LX0RJU1RBTkNFKSxcbiAgfSxcbiAgcG9zaXRpb25pbmc6IHtcbiAgICBmb3JjZVg6IHtcbiAgICAgIHg6IDAsXG4gICAgICBzdHJlbmd0aDogMC4xLFxuICAgIH0sXG4gICAgZm9yY2VZOiB7XG4gICAgICB5OiAwLFxuICAgICAgc3RyZW5ndGg6IDAuMSxcbiAgICB9LFxuICB9LFxufTtcblxuZXhwb3J0IGludGVyZmFjZSBJRDNTaW11bGF0b3JQcm9ncmVzcyB7XG4gIHByb2dyZXNzOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUQzU2ltdWxhdG9yR3JhcGgge1xuICBub2RlczogSVNpbXVsYXRpb25Ob2RlW107XG4gIGVkZ2VzOiBJU2ltdWxhdGlvbkVkZ2VbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRDNTaW11bGF0b3JOb2RlSWQge1xuICBpZDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEM1NpbXVsYXRvclNldHRpbmdzIHtcbiAgc2V0dGluZ3M6IElEM1NpbXVsYXRvckVuZ2luZVNldHRpbmdzO1xufVxuXG5pbnRlcmZhY2UgSVJ1blNpbXVsYXRpb25PcHRpb25zIHtcbiAgaXNVcGRhdGluZ1NldHRpbmdzOiBib29sZWFuO1xufVxuXG5leHBvcnQgdHlwZSBEM1NpbXVsYXRvckV2ZW50cyA9IHtcbiAgW0QzU2ltdWxhdG9yRW5naW5lRXZlbnRUeXBlLlRJQ0tdOiBJRDNTaW11bGF0b3JHcmFwaDtcbiAgW0QzU2ltdWxhdG9yRW5naW5lRXZlbnRUeXBlLkVORF06IElEM1NpbXVsYXRvckdyYXBoO1xuICBbRDNTaW11bGF0b3JFbmdpbmVFdmVudFR5cGUuU0lNVUxBVElPTl9TVEFSVF06IHVuZGVmaW5lZDtcbiAgW0QzU2ltdWxhdG9yRW5naW5lRXZlbnRUeXBlLlNJTVVMQVRJT05fUFJPR1JFU1NdOiBJRDNTaW11bGF0b3JHcmFwaCAmIElEM1NpbXVsYXRvclByb2dyZXNzO1xuICBbRDNTaW11bGF0b3JFbmdpbmVFdmVudFR5cGUuU0lNVUxBVElPTl9FTkRdOiBJRDNTaW11bGF0b3JHcmFwaDtcbiAgW0QzU2ltdWxhdG9yRW5naW5lRXZlbnRUeXBlLk5PREVfRFJBR106IElEM1NpbXVsYXRvckdyYXBoO1xuICBbRDNTaW11bGF0b3JFbmdpbmVFdmVudFR5cGUuU0VUVElOR1NfVVBEQVRFXTogSUQzU2ltdWxhdG9yU2V0dGluZ3M7XG59O1xuXG5leHBvcnQgY2xhc3MgRDNTaW11bGF0b3JFbmdpbmUgZXh0ZW5kcyBFbWl0dGVyPEQzU2ltdWxhdG9yRXZlbnRzPiB7XG4gIHByb3RlY3RlZCByZWFkb25seSBsaW5rRm9yY2U6IEZvcmNlTGluazxJU2ltdWxhdGlvbk5vZGUsIFNpbXVsYXRpb25MaW5rRGF0dW08SVNpbXVsYXRpb25Ob2RlPj47XG4gIHByb3RlY3RlZCByZWFkb25seSBzaW11bGF0aW9uOiBTaW11bGF0aW9uPElTaW11bGF0aW9uTm9kZSwgdW5kZWZpbmVkPjtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IHNldHRpbmdzOiBJRDNTaW11bGF0b3JFbmdpbmVTZXR0aW5ncztcblxuICBwcm90ZWN0ZWQgX2VkZ2VzOiBJU2ltdWxhdGlvbkVkZ2VbXSA9IFtdO1xuICBwcm90ZWN0ZWQgX25vZGVzOiBJU2ltdWxhdGlvbk5vZGVbXSA9IFtdO1xuICBwcm90ZWN0ZWQgX25vZGVJbmRleEJ5Tm9kZUlkOiBSZWNvcmQ8bnVtYmVyLCBudW1iZXI+ID0ge307XG5cbiAgcHJvdGVjdGVkIF9pc0RyYWdnaW5nID0gZmFsc2U7XG4gIHByb3RlY3RlZCBfaXNTdGFiaWxpemluZyA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHNldHRpbmdzPzogSUQzU2ltdWxhdG9yRW5naW5lU2V0dGluZ3MpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5saW5rRm9yY2UgPSBmb3JjZUxpbms8SVNpbXVsYXRpb25Ob2RlLCBTaW11bGF0aW9uTGlua0RhdHVtPElTaW11bGF0aW9uTm9kZT4+KHRoaXMuX2VkZ2VzKS5pZChcbiAgICAgIChub2RlKSA9PiBub2RlLmlkLFxuICAgICk7XG4gICAgdGhpcy5zaW11bGF0aW9uID0gZm9yY2VTaW11bGF0aW9uKHRoaXMuX25vZGVzKS5mb3JjZSgnbGluaycsIHRoaXMubGlua0ZvcmNlKS5zdG9wKCk7XG5cbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbihjb3B5T2JqZWN0KERFRkFVTFRfU0VUVElOR1MpLCBzZXR0aW5ncyk7XG4gICAgdGhpcy5pbml0U2ltdWxhdGlvbih0aGlzLnNldHRpbmdzKTtcblxuICAgIHRoaXMuc2ltdWxhdGlvbi5vbigndGljaycsICgpID0+IHtcbiAgICAgIHRoaXMuZW1pdChEM1NpbXVsYXRvckVuZ2luZUV2ZW50VHlwZS5USUNLLCB7IG5vZGVzOiB0aGlzLl9ub2RlcywgZWRnZXM6IHRoaXMuX2VkZ2VzIH0pO1xuICAgIH0pO1xuXG4gICAgdGhpcy5zaW11bGF0aW9uLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICB0aGlzLl9pc0RyYWdnaW5nID0gZmFsc2U7XG4gICAgICB0aGlzLl9pc1N0YWJpbGl6aW5nID0gZmFsc2U7XG4gICAgICB0aGlzLmVtaXQoRDNTaW11bGF0b3JFbmdpbmVFdmVudFR5cGUuRU5ELCB7IG5vZGVzOiB0aGlzLl9ub2RlcywgZWRnZXM6IHRoaXMuX2VkZ2VzIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0U2V0dGluZ3MoKTogSUQzU2ltdWxhdG9yRW5naW5lU2V0dGluZ3Mge1xuICAgIHJldHVybiBjb3B5T2JqZWN0KHRoaXMuc2V0dGluZ3MpO1xuICB9XG5cbiAgc2V0U2V0dGluZ3Moc2V0dGluZ3M6IElEM1NpbXVsYXRvckVuZ2luZVNldHRpbmdzVXBkYXRlKSB7XG4gICAgY29uc3QgcHJldmlvdXNTZXR0aW5ncyA9IHRoaXMuZ2V0U2V0dGluZ3MoKTtcbiAgICBPYmplY3Qua2V5cyhzZXR0aW5ncykuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICB0aGlzLnNldHRpbmdzW2tleV0gPSBzZXR0aW5nc1trZXldO1xuICAgIH0pO1xuXG4gICAgaWYgKGlzT2JqZWN0RXF1YWwodGhpcy5zZXR0aW5ncywgcHJldmlvdXNTZXR0aW5ncykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmluaXRTaW11bGF0aW9uKHNldHRpbmdzKTtcbiAgICB0aGlzLmVtaXQoRDNTaW11bGF0b3JFbmdpbmVFdmVudFR5cGUuU0VUVElOR1NfVVBEQVRFLCB7IHNldHRpbmdzOiB0aGlzLnNldHRpbmdzIH0pO1xuXG4gICAgdGhpcy5ydW5TaW11bGF0aW9uKHsgaXNVcGRhdGluZ1NldHRpbmdzOiB0cnVlIH0pO1xuICB9XG5cbiAgc3RhcnREcmFnTm9kZSgpIHtcbiAgICB0aGlzLl9pc0RyYWdnaW5nID0gdHJ1ZTtcblxuICAgIGlmICghdGhpcy5faXNTdGFiaWxpemluZyAmJiB0aGlzLnNldHRpbmdzLmlzUGh5c2ljc0VuYWJsZWQpIHtcbiAgICAgIHRoaXMuYWN0aXZhdGVTaW11bGF0aW9uKCk7XG4gICAgfVxuICB9XG5cbiAgZHJhZ05vZGUoZGF0YTogSUQzU2ltdWxhdG9yTm9kZUlkICYgSVBvc2l0aW9uKSB7XG4gICAgY29uc3Qgbm9kZSA9IHRoaXMuX25vZGVzW3RoaXMuX25vZGVJbmRleEJ5Tm9kZUlkW2RhdGEuaWRdXTtcbiAgICBpZiAoIW5vZGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX2lzRHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMuc3RhcnREcmFnTm9kZSgpO1xuICAgIH1cblxuICAgIG5vZGUuZnggPSBkYXRhLng7XG4gICAgbm9kZS5meSA9IGRhdGEueTtcblxuICAgIGlmICghdGhpcy5zZXR0aW5ncy5pc1BoeXNpY3NFbmFibGVkKSB7XG4gICAgICBub2RlLnggPSBkYXRhLng7XG4gICAgICBub2RlLnkgPSBkYXRhLnk7XG5cbiAgICAgIC8vIE5vdGlmeSB0aGUgY2xpZW50IHRoYXQgdGhlIG5vZGUgcG9zaXRpb24gY2hhbmdlZC5cbiAgICAgIC8vIFRoaXMgaXMgb3RoZXJ3aXNlIGhhbmRsZWQgYnkgdGhlIHNpbXVsYXRpb24gdGljayBpZiBwaHlzaWNzIGlzIGVuYWJsZWQuXG4gICAgICB0aGlzLmVtaXQoRDNTaW11bGF0b3JFbmdpbmVFdmVudFR5cGUuTk9ERV9EUkFHLCB7IG5vZGVzOiB0aGlzLl9ub2RlcywgZWRnZXM6IHRoaXMuX2VkZ2VzIH0pO1xuICAgIH1cbiAgfVxuXG4gIGVuZERyYWdOb2RlKGRhdGE6IElEM1NpbXVsYXRvck5vZGVJZCkge1xuICAgIHRoaXMuX2lzRHJhZ2dpbmcgPSBmYWxzZTtcblxuICAgIHRoaXMuc2ltdWxhdGlvbi5hbHBoYVRhcmdldCgwKTtcbiAgICBjb25zdCBub2RlID0gdGhpcy5fbm9kZXNbdGhpcy5fbm9kZUluZGV4QnlOb2RlSWRbZGF0YS5pZF1dO1xuICAgIGlmIChub2RlICYmIHRoaXMuc2V0dGluZ3MuaXNQaHlzaWNzRW5hYmxlZCkge1xuICAgICAgcmVsZWFzZU5vZGUobm9kZSk7XG4gICAgfVxuICB9XG5cbiAgLy8gUmUtaGVhdCBzaW11bGF0aW9uLlxuICAvLyBUaGlzIGRvZXMgbm90IGNvdW50IGFzIFwic3RhYmlsaXphdGlvblwiIGFuZCB3b24ndCBlbWl0IGFueSBwcm9ncmVzcy5cbiAgYWN0aXZhdGVTaW11bGF0aW9uKCkge1xuICAgIGlmICh0aGlzLnNldHRpbmdzLmlzUGh5c2ljc0VuYWJsZWQpIHtcbiAgICAgIHRoaXMuc2ltdWxhdGlvbi5hbHBoYVRhcmdldCh0aGlzLnNldHRpbmdzLmFscGhhLmFscGhhVGFyZ2V0KS5yZXN0YXJ0KCk7XG4gICAgICB0aGlzLnJlbGVhc2VOb2RlcygpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZml4RGVmaW5lZE5vZGVzKGRhdGE6IElEM1NpbXVsYXRvckdyYXBoKSB7XG4gICAgLy8gVHJlYXQgbm9kZXMgdGhhdCBoYXZlIGV4aXN0aW5nIGNvb3JkaW5hdGVzIGFzIFwiZml4ZWRcIi5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChkYXRhLm5vZGVzW2ldLnggIT09IG51bGwgJiYgZGF0YS5ub2Rlc1tpXS54ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZGF0YS5ub2Rlc1tpXS5meCA9IGRhdGEubm9kZXNbaV0ueDtcbiAgICAgIH1cbiAgICAgIGlmIChkYXRhLm5vZGVzW2ldLnkgIT09IG51bGwgJiYgZGF0YS5ub2Rlc1tpXS55ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZGF0YS5ub2Rlc1tpXS5meSA9IGRhdGEubm9kZXNbaV0ueTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1cblxuICBhZGREYXRhKGRhdGE6IElEM1NpbXVsYXRvckdyYXBoKSB7XG4gICAgZGF0YSA9IHRoaXMuZml4RGVmaW5lZE5vZGVzKGRhdGEpO1xuICAgIHRoaXMuX25vZGVzLmNvbmNhdChkYXRhLm5vZGVzKTtcbiAgICB0aGlzLl9lZGdlcy5jb25jYXQoZGF0YS5lZGdlcyk7XG4gICAgdGhpcy5zZXROb2RlSW5kZXhCeU5vZGVJZCgpO1xuICB9XG5cbiAgY2xlYXJEYXRhKCkge1xuICAgIHRoaXMuX25vZGVzID0gW107XG4gICAgdGhpcy5fZWRnZXMgPSBbXTtcbiAgICB0aGlzLnNldE5vZGVJbmRleEJ5Tm9kZUlkKCk7XG4gIH1cblxuICBzZXREYXRhKGRhdGE6IElEM1NpbXVsYXRvckdyYXBoKSB7XG4gICAgZGF0YSA9IHRoaXMuZml4RGVmaW5lZE5vZGVzKGRhdGEpO1xuICAgIHRoaXMuY2xlYXJEYXRhKCk7XG4gICAgdGhpcy5hZGREYXRhKGRhdGEpO1xuICB9XG5cbiAgdXBkYXRlRGF0YShkYXRhOiBJRDNTaW11bGF0b3JHcmFwaCkge1xuICAgIGRhdGEgPSB0aGlzLmZpeERlZmluZWROb2RlcyhkYXRhKTtcbiAgICAvLyBLZWVwIGV4aXN0aW5nIG5vZGVzIGFsb25nIHdpdGggdGhlaXIgKHgsIHksIGZ4LCBmeSkgY29vcmRpbmF0ZXMgdG8gYXZvaWRcbiAgICAvLyByZWFycmFuZ2luZyB0aGUgZ3JhcGggbGF5b3V0LlxuICAgIC8vIFRoZXNlIG5vZGVzIHNob3VsZCBub3QgYmUgcmVsb2FkZWQgaW50byB0aGUgYXJyYXkgYmVjYXVzZSB0aGUgRDMgc2ltdWxhdGlvblxuICAgIC8vIHdpbGwgYXNzaWduIHRvIHRoZW0gY29tcGxldGVseSBuZXcgY29vcmRpbmF0ZXMsIGVmZmVjdGl2ZWx5IHJlc3RhcnRpbmcgdGhlIGFuaW1hdGlvbi5cbiAgICBjb25zdCBuZXdOb2RlSWRzID0gbmV3IFNldChkYXRhLm5vZGVzLm1hcCgobm9kZSkgPT4gbm9kZS5pZCkpO1xuXG4gICAgLy8gUmVtb3ZlIG9sZCBub2RlcyB0aGF0IGFyZW4ndCBwcmVzZW50IGluIHRoZSBuZXcgZGF0YS5cbiAgICBjb25zdCBvbGROb2RlcyA9IHRoaXMuX25vZGVzLmZpbHRlcigobm9kZSkgPT4gbmV3Tm9kZUlkcy5oYXMobm9kZS5pZCkpO1xuICAgIGNvbnN0IG5ld05vZGVzID0gZGF0YS5ub2Rlcy5maWx0ZXIoKG5vZGUpID0+IHRoaXMuX25vZGVJbmRleEJ5Tm9kZUlkW25vZGUuaWRdID09PSB1bmRlZmluZWQpO1xuXG4gICAgdGhpcy5fbm9kZXMgPSBbLi4ub2xkTm9kZXMsIC4uLm5ld05vZGVzXTtcbiAgICB0aGlzLnNldE5vZGVJbmRleEJ5Tm9kZUlkKCk7XG5cbiAgICAvLyBPbmx5IGtlZXAgbmV3IGxpbmtzIGFuZCBkaXNjYXJkIGFsbCBvbGQgbGlua3MuXG4gICAgLy8gT2xkIGxpbmtzIHdvbid0IHdvcmsgYXMgc29tZSBkaXNjcmVwYW5jaWVzIGFyaXNlIGJldHdlZW4gdGhlIEQzIGluZGV4IHByb3BlcnR5XG4gICAgLy8gYW5kIE1lbWdyYXBoJ3MgYGlkYCBwcm9wZXJ0eSB3aGljaCBhZmZlY3RzIHRoZSBzb3VyY2UtPnRhcmdldCBtYXBwaW5nLlxuICAgIHRoaXMuX2VkZ2VzID0gZGF0YS5lZGdlcztcblxuICAgIC8vIFVwZGF0ZSBzaW11bGF0aW9uIHdpdGggbmV3IGRhdGEuXG4gICAgdGhpcy5zaW11bGF0aW9uLm5vZGVzKHRoaXMuX25vZGVzKTtcbiAgICB0aGlzLmxpbmtGb3JjZS5saW5rcyh0aGlzLl9lZGdlcyk7XG4gIH1cblxuICBzaW11bGF0ZSgpIHtcbiAgICAvLyBVcGRhdGUgc2ltdWxhdGlvbiB3aXRoIG5ldyBkYXRhLlxuICAgIHRoaXMuc2ltdWxhdGlvbi5ub2Rlcyh0aGlzLl9ub2Rlcyk7XG4gICAgdGhpcy5saW5rRm9yY2UubGlua3ModGhpcy5fZWRnZXMpO1xuXG4gICAgLy8gUnVuIHNpbXVsYXRpb24gXCJwaHlzaWNzXCIuXG4gICAgdGhpcy5ydW5TaW11bGF0aW9uKCk7XG5cbiAgICBpZiAoIXRoaXMuc2V0dGluZ3MuaXNQaHlzaWNzRW5hYmxlZCkge1xuICAgICAgdGhpcy5maXhOb2RlcygpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXJ0U2ltdWxhdGlvbihkYXRhOiBJRDNTaW11bGF0b3JHcmFwaCkge1xuICAgIHRoaXMuc2V0RGF0YShkYXRhKTtcblxuICAgIC8vIFVwZGF0ZSBzaW11bGF0aW9uIHdpdGggbmV3IGRhdGEuXG4gICAgdGhpcy5zaW11bGF0aW9uLm5vZGVzKHRoaXMuX25vZGVzKTtcbiAgICB0aGlzLmxpbmtGb3JjZS5saW5rcyh0aGlzLl9lZGdlcyk7XG5cbiAgICAvLyBSdW4gc2ltdWxhdGlvbiBcInBoeXNpY3NcIi5cbiAgICB0aGlzLnJ1blNpbXVsYXRpb24oKTtcbiAgfVxuXG4gIHVwZGF0ZVNpbXVsYXRpb24oZGF0YTogSUQzU2ltdWxhdG9yR3JhcGgpIHtcbiAgICAvLyBUbyBhdm9pZCByZWFycmFuZ2luZyB0aGUgZ3JhcGggbGF5b3V0IGR1cmluZyBub2RlIGV4cGFuZC9jb2xsYXBzZS9oaWRlLFxuICAgIC8vIGl0IGlzIG5lY2Vzc2FyeSB0byBrZWVwIGV4aXN0aW5nIG5vZGVzIGFsb25nIHdpdGggdGhlaXIgKHgsIHkpIGNvb3JkaW5hdGVzLlxuICAgIC8vIFRoZXNlIG5vZGVzIHNob3VsZCBub3QgYmUgcmVsb2FkZWQgaW50byB0aGUgYXJyYXkgYmVjYXVzZSB0aGUgRDMgc2ltdWxhdGlvblxuICAgIC8vIHdpbGwgYXNzaWduIHRvIHRoZW0gY29tcGxldGVseSBuZXcgY29vcmRpbmF0ZXMsIGVmZmVjdGl2ZWx5IHJlc3RhcnRpbmcgdGhlIGFuaW1hdGlvbi5cbiAgICBjb25zdCBuZXdOb2RlSWRzID0gbmV3IFNldChkYXRhLm5vZGVzLm1hcCgobm9kZSkgPT4gbm9kZS5pZCkpO1xuXG4gICAgLy8gY29uc3QgbmV3Tm9kZXMgPSBkYXRhLm5vZGVzLmZpbHRlcigobm9kZSkgPT4gIXRoaXMubm9kZUlkZW50aXRpZXMuaGFzKG5vZGUuaWQpKTtcbiAgICBjb25zdCBuZXdOb2RlcyA9IGRhdGEubm9kZXMuZmlsdGVyKChub2RlKSA9PiB0aGlzLl9ub2RlSW5kZXhCeU5vZGVJZFtub2RlLmlkXSA9PT0gdW5kZWZpbmVkKTtcbiAgICBjb25zdCBvbGROb2RlcyA9IHRoaXMuX25vZGVzLmZpbHRlcigobm9kZSkgPT4gbmV3Tm9kZUlkcy5oYXMobm9kZS5pZCkpO1xuXG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLmlzUGh5c2ljc0VuYWJsZWQpIHtcbiAgICAgIG9sZE5vZGVzLmZvckVhY2goKG5vZGUpID0+IGZpeE5vZGUobm9kZSkpO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBvbGQgbm9kZXMgdGhhdCBhcmVuJ3QgcHJlc2VudCBpbiB0aGUgbmV3IGRhdGEuXG4gICAgdGhpcy5fbm9kZXMgPSBbLi4ub2xkTm9kZXMsIC4uLm5ld05vZGVzXTtcbiAgICB0aGlzLnNldE5vZGVJbmRleEJ5Tm9kZUlkKCk7XG5cbiAgICAvLyBPbmx5IGtlZXAgbmV3IGxpbmtzIGFuZCBkaXNjYXJkIGFsbCBvbGQgbGlua3MuXG4gICAgLy8gT2xkIGxpbmtzIHdvbid0IHdvcmsgYXMgc29tZSBkaXNjcmVwYW5jaWVzIGFyaXNlIGJldHdlZW4gdGhlIEQzIGluZGV4IHByb3BlcnR5XG4gICAgLy8gYW5kIE1lbWdyYXBoJ3MgYGlkYCBwcm9wZXJ0eSB3aGljaCBhZmZlY3RzIHRoZSBzb3VyY2UtPnRhcmdldCBtYXBwaW5nLlxuICAgIHRoaXMuX2VkZ2VzID0gZGF0YS5lZGdlcztcblxuICAgIC8vIFVwZGF0ZSBzaW11bGF0aW9uIHdpdGggbmV3IGRhdGEuXG4gICAgdGhpcy5zaW11bGF0aW9uLm5vZGVzKHRoaXMuX25vZGVzKTtcbiAgICB0aGlzLmxpbmtGb3JjZS5saW5rcyh0aGlzLl9lZGdlcyk7XG5cbiAgICAvLyBJZiB0aGVyZSBhcmUgbm8gbmV3IG5vZGVzLCB0aGVyZSBpcyBubyBuZWVkIGZvciB0aGUgc2ltdWxhdGlvblxuICAgIGlmICghdGhpcy5zZXR0aW5ncy5pc1BoeXNpY3NFbmFibGVkICYmICFuZXdOb2Rlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZW1pdChEM1NpbXVsYXRvckVuZ2luZUV2ZW50VHlwZS5TSU1VTEFUSU9OX0VORCwgeyBub2RlczogdGhpcy5fbm9kZXMsIGVkZ2VzOiB0aGlzLl9lZGdlcyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBSdW4gc2ltdWxhdGlvbiBcInBoeXNpY3NcIi5cbiAgICB0aGlzLnJ1blNpbXVsYXRpb24oeyBpc1VwZGF0aW5nU2V0dGluZ3M6IHRydWUgfSk7XG4gIH1cblxuICBzdG9wU2ltdWxhdGlvbigpIHtcbiAgICB0aGlzLnNpbXVsYXRpb24uc3RvcCgpO1xuICAgIHRoaXMuX25vZGVzID0gW107XG4gICAgdGhpcy5fZWRnZXMgPSBbXTtcbiAgICB0aGlzLnNldE5vZGVJbmRleEJ5Tm9kZUlkKCk7XG4gICAgdGhpcy5zaW11bGF0aW9uLm5vZGVzKCk7XG4gICAgdGhpcy5saW5rRm9yY2UubGlua3MoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBpbml0U2ltdWxhdGlvbihzZXR0aW5nczogSUQzU2ltdWxhdG9yRW5naW5lU2V0dGluZ3NVcGRhdGUpIHtcbiAgICBpZiAoc2V0dGluZ3MuYWxwaGEpIHtcbiAgICAgIHRoaXMuc2ltdWxhdGlvblxuICAgICAgICAuYWxwaGEoc2V0dGluZ3MuYWxwaGEuYWxwaGEpXG4gICAgICAgIC5hbHBoYU1pbihzZXR0aW5ncy5hbHBoYS5hbHBoYU1pbilcbiAgICAgICAgLmFscGhhRGVjYXkoc2V0dGluZ3MuYWxwaGEuYWxwaGFEZWNheSlcbiAgICAgICAgLmFscGhhVGFyZ2V0KHNldHRpbmdzLmFscGhhLmFscGhhVGFyZ2V0KTtcbiAgICB9XG4gICAgaWYgKHNldHRpbmdzLmxpbmtzKSB7XG4gICAgICB0aGlzLmxpbmtGb3JjZS5kaXN0YW5jZShzZXR0aW5ncy5saW5rcy5kaXN0YW5jZSkuaXRlcmF0aW9ucyhzZXR0aW5ncy5saW5rcy5pdGVyYXRpb25zKTtcbiAgICB9XG4gICAgaWYgKHNldHRpbmdzLmNvbGxpc2lvbikge1xuICAgICAgY29uc3QgY29sbGlzaW9uID0gZm9yY2VDb2xsaWRlKClcbiAgICAgICAgLnJhZGl1cyhzZXR0aW5ncy5jb2xsaXNpb24ucmFkaXVzKVxuICAgICAgICAuc3RyZW5ndGgoc2V0dGluZ3MuY29sbGlzaW9uLnN0cmVuZ3RoKVxuICAgICAgICAuaXRlcmF0aW9ucyhzZXR0aW5ncy5jb2xsaXNpb24uaXRlcmF0aW9ucyk7XG4gICAgICB0aGlzLnNpbXVsYXRpb24uZm9yY2UoJ2NvbGxpZGUnLCBjb2xsaXNpb24pO1xuICAgIH1cbiAgICBpZiAoc2V0dGluZ3MuY29sbGlzaW9uID09PSBudWxsKSB7XG4gICAgICB0aGlzLnNpbXVsYXRpb24uZm9yY2UoJ2NvbGxpZGUnLCBudWxsKTtcbiAgICB9XG4gICAgaWYgKHNldHRpbmdzLm1hbnlCb2R5KSB7XG4gICAgICBjb25zdCBtYW55Qm9keSA9IGZvcmNlTWFueUJvZHkoKVxuICAgICAgICAuc3RyZW5ndGgoc2V0dGluZ3MubWFueUJvZHkuc3RyZW5ndGgpXG4gICAgICAgIC50aGV0YShzZXR0aW5ncy5tYW55Qm9keS50aGV0YSlcbiAgICAgICAgLmRpc3RhbmNlTWluKHNldHRpbmdzLm1hbnlCb2R5LmRpc3RhbmNlTWluKVxuICAgICAgICAuZGlzdGFuY2VNYXgoc2V0dGluZ3MubWFueUJvZHkuZGlzdGFuY2VNYXgpO1xuICAgICAgdGhpcy5zaW11bGF0aW9uLmZvcmNlKCdjaGFyZ2UnLCBtYW55Qm9keSk7XG4gICAgfVxuICAgIGlmIChzZXR0aW5ncy5tYW55Qm9keSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5zaW11bGF0aW9uLmZvcmNlKCdjaGFyZ2UnLCBudWxsKTtcbiAgICB9XG4gICAgaWYgKHNldHRpbmdzLnBvc2l0aW9uaW5nPy5mb3JjZVkpIHtcbiAgICAgIGNvbnN0IHBvc2l0aW9uaW5nRm9yY2VYID0gZm9yY2VYKHNldHRpbmdzLnBvc2l0aW9uaW5nLmZvcmNlWC54KS5zdHJlbmd0aChzZXR0aW5ncy5wb3NpdGlvbmluZy5mb3JjZVguc3RyZW5ndGgpO1xuICAgICAgdGhpcy5zaW11bGF0aW9uLmZvcmNlKCd4JywgcG9zaXRpb25pbmdGb3JjZVgpO1xuICAgIH1cbiAgICBpZiAoc2V0dGluZ3MucG9zaXRpb25pbmc/LmZvcmNlWCA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5zaW11bGF0aW9uLmZvcmNlKCd4JywgbnVsbCk7XG4gICAgfVxuICAgIGlmIChzZXR0aW5ncy5wb3NpdGlvbmluZz8uZm9yY2VZKSB7XG4gICAgICBjb25zdCBwb3NpdGlvbmluZ0ZvcmNlWSA9IGZvcmNlWShzZXR0aW5ncy5wb3NpdGlvbmluZy5mb3JjZVkueSkuc3RyZW5ndGgoc2V0dGluZ3MucG9zaXRpb25pbmcuZm9yY2VZLnN0cmVuZ3RoKTtcbiAgICAgIHRoaXMuc2ltdWxhdGlvbi5mb3JjZSgneScsIHBvc2l0aW9uaW5nRm9yY2VZKTtcbiAgICB9XG4gICAgaWYgKHNldHRpbmdzLnBvc2l0aW9uaW5nPy5mb3JjZVkgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuc2ltdWxhdGlvbi5mb3JjZSgneScsIG51bGwpO1xuICAgIH1cbiAgICBpZiAoc2V0dGluZ3MuY2VudGVyaW5nKSB7XG4gICAgICBjb25zdCBjZW50ZXJpbmcgPSBmb3JjZUNlbnRlcihzZXR0aW5ncy5jZW50ZXJpbmcueCwgc2V0dGluZ3MuY2VudGVyaW5nLnkpLnN0cmVuZ3RoKHNldHRpbmdzLmNlbnRlcmluZy5zdHJlbmd0aCk7XG4gICAgICB0aGlzLnNpbXVsYXRpb24uZm9yY2UoJ2NlbnRlcicsIGNlbnRlcmluZyk7XG4gICAgfVxuICAgIGlmIChzZXR0aW5ncy5jZW50ZXJpbmcgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuc2ltdWxhdGlvbi5mb3JjZSgnY2VudGVyJywgbnVsbCk7XG4gICAgfVxuICB9XG5cbiAgLy8gVGhpcyBpcyBhIGJsb2NraW5nIGFjdGlvbiAtIHRoZSB1c2VyIHdpbGwgbm90IGJlIGFibGUgdG8gaW50ZXJhY3Qgd2l0aCB0aGUgZ3JhcGhcbiAgLy8gZHVyaW5nIHRoZSBzaW11bGF0aW9uIHByb2Nlc3MuXG4gIHByb3RlY3RlZCBydW5TaW11bGF0aW9uKG9wdGlvbnM/OiBJUnVuU2ltdWxhdGlvbk9wdGlvbnMpIHtcbiAgICBpZiAodGhpcy5faXNTdGFiaWxpemluZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodGhpcy5zZXR0aW5ncy5pc1BoeXNpY3NFbmFibGVkIHx8IG9wdGlvbnM/LmlzVXBkYXRpbmdTZXR0aW5ncykge1xuICAgICAgdGhpcy5yZWxlYXNlTm9kZXMoKTtcbiAgICB9XG5cbiAgICB0aGlzLmVtaXQoRDNTaW11bGF0b3JFbmdpbmVFdmVudFR5cGUuU0lNVUxBVElPTl9TVEFSVCwgdW5kZWZpbmVkKTtcblxuICAgIHRoaXMuX2lzU3RhYmlsaXppbmcgPSB0cnVlO1xuICAgIHRoaXMuc2ltdWxhdGlvbi5hbHBoYSh0aGlzLnNldHRpbmdzLmFscGhhLmFscGhhKS5hbHBoYVRhcmdldCh0aGlzLnNldHRpbmdzLmFscGhhLmFscGhhVGFyZ2V0KS5zdG9wKCk7XG5cbiAgICBjb25zdCB0b3RhbFNpbXVsYXRpb25TdGVwcyA9IE1hdGguY2VpbChcbiAgICAgIE1hdGgubG9nKHRoaXMuc2V0dGluZ3MuYWxwaGEuYWxwaGFNaW4pIC8gTWF0aC5sb2coMSAtIHRoaXMuc2V0dGluZ3MuYWxwaGEuYWxwaGFEZWNheSksXG4gICAgKTtcblxuICAgIGxldCBsYXN0UHJvZ3Jlc3MgPSAtMTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRvdGFsU2ltdWxhdGlvblN0ZXBzOyBpKyspIHtcbiAgICAgIGNvbnN0IGN1cnJlbnRQcm9ncmVzcyA9IE1hdGgucm91bmQoKGkgKiAxMDApIC8gdG90YWxTaW11bGF0aW9uU3RlcHMpO1xuICAgICAgLy8gRW1pdCBwcm9ncmVzcyBtYXhpbXVtIG9mIDEwMCB0aW1lcyAoZXZlcnkgcGVyY2VudClcbiAgICAgIGlmIChjdXJyZW50UHJvZ3Jlc3MgPiBsYXN0UHJvZ3Jlc3MpIHtcbiAgICAgICAgbGFzdFByb2dyZXNzID0gY3VycmVudFByb2dyZXNzO1xuICAgICAgICB0aGlzLmVtaXQoRDNTaW11bGF0b3JFbmdpbmVFdmVudFR5cGUuU0lNVUxBVElPTl9QUk9HUkVTUywge1xuICAgICAgICAgIG5vZGVzOiB0aGlzLl9ub2RlcyxcbiAgICAgICAgICBlZGdlczogdGhpcy5fZWRnZXMsXG4gICAgICAgICAgcHJvZ3Jlc3M6IGN1cnJlbnRQcm9ncmVzcyAvIDEwMCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICB0aGlzLnNpbXVsYXRpb24udGljaygpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5zZXR0aW5ncy5pc1BoeXNpY3NFbmFibGVkKSB7XG4gICAgICB0aGlzLmZpeE5vZGVzKCk7XG4gICAgfVxuXG4gICAgdGhpcy5faXNTdGFiaWxpemluZyA9IGZhbHNlO1xuICAgIHRoaXMuZW1pdChEM1NpbXVsYXRvckVuZ2luZUV2ZW50VHlwZS5TSU1VTEFUSU9OX0VORCwgeyBub2RlczogdGhpcy5fbm9kZXMsIGVkZ2VzOiB0aGlzLl9lZGdlcyB9KTtcbiAgfVxuXG4gIHByb3RlY3RlZCBzZXROb2RlSW5kZXhCeU5vZGVJZCgpIHtcbiAgICB0aGlzLl9ub2RlSW5kZXhCeU5vZGVJZCA9IHt9O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuX25vZGVJbmRleEJ5Tm9kZUlkW3RoaXMuX25vZGVzW2ldLmlkXSA9IGk7XG4gICAgfVxuICB9XG5cbiAgZml4Tm9kZXMobm9kZXM/OiBJU2ltdWxhdGlvbk5vZGVbXSkge1xuICAgIGlmICghbm9kZXMpIHtcbiAgICAgIG5vZGVzID0gdGhpcy5fbm9kZXM7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgZml4Tm9kZSh0aGlzLl9ub2Rlc1tpXSk7XG4gICAgfVxuICB9XG5cbiAgcmVsZWFzZU5vZGVzKG5vZGVzPzogSVNpbXVsYXRpb25Ob2RlW10pIHtcbiAgICBpZiAoIW5vZGVzKSB7XG4gICAgICBub2RlcyA9IHRoaXMuX25vZGVzO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlbGVhc2VOb2RlKHRoaXMuX25vZGVzW2ldKTtcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgZml4Tm9kZSA9IChub2RlOiBJU2ltdWxhdGlvbk5vZGUpID0+IHtcbiAgLy8gZnggYW5kIGZ5IGZpeCB0aGUgbm9kZSBwb3NpdGlvbiBpbiB0aGUgRDMgc2ltdWxhdGlvbi5cbiAgbm9kZS5meCA9IG5vZGUueDtcbiAgbm9kZS5meSA9IG5vZGUueTtcbn07XG5cbmNvbnN0IHJlbGVhc2VOb2RlID0gKG5vZGU6IElTaW11bGF0aW9uTm9kZSkgPT4ge1xuICBub2RlLmZ4ID0gbnVsbDtcbiAgbm9kZS5meSA9IG51bGw7XG59O1xuIiwiaW1wb3J0IHsgSVBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uJztcbmltcG9ydCB7IElTaW11bGF0aW9uTm9kZSwgSVNpbXVsYXRpb25FZGdlIH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkJztcbmltcG9ydCB7IElEM1NpbXVsYXRvckVuZ2luZVNldHRpbmdzVXBkYXRlIH0gZnJvbSAnLi4vLi4vLi4vZW5naW5lL2QzLXNpbXVsYXRvci1lbmdpbmUnO1xuaW1wb3J0IHsgSVdvcmtlclBheWxvYWQgfSBmcm9tICcuL3dvcmtlci1wYXlsb2FkJztcblxuLy8gTWVzc2FnZXMgYXJlIG9iamVjdHMgZ29pbmcgaW50byB0aGUgc2ltdWxhdGlvbiB3b3JrZXIuXG4vLyBUaGV5IGNhbiBiZSB0aG91Z2h0IG9mIHNpbWlsYXIgdG8gcmVxdWVzdHMuXG4vLyAobm90IHF1aXRlIGFzIHRoZXJlIGlzIG5vIGltbWVkaWF0ZSByZXNwb25zZSB0byBhIHJlcXVlc3QpXG5cbmV4cG9ydCBlbnVtIFdvcmtlcklucHV0VHlwZSB7XG4gIC8vIFNldCBub2RlIGFuZCBlZGdlIGRhdGEgd2l0aG91dCBzaW11bGF0aW5nXG4gIFNldERhdGEgPSAnU2V0IERhdGEnLFxuICBBZGREYXRhID0gJ0FkZCBEYXRhJyxcbiAgVXBkYXRlRGF0YSA9ICdVcGRhdGUgRGF0YScsXG4gIENsZWFyRGF0YSA9ICdDbGVhciBEYXRhJyxcblxuICAvLyBTaW11bGF0aW9uIG1lc3NhZ2UgdHlwZXNcbiAgU2ltdWxhdGUgPSAnU2ltdWxhdGUnLFxuICBBY3RpdmF0ZVNpbXVsYXRpb24gPSAnQWN0aXZhdGUgU2ltdWxhdGlvbicsXG4gIFN0YXJ0U2ltdWxhdGlvbiA9ICdTdGFydCBTaW11bGF0aW9uJyxcbiAgVXBkYXRlU2ltdWxhdGlvbiA9ICdVcGRhdGUgU2ltdWxhdGlvbicsXG4gIFN0b3BTaW11bGF0aW9uID0gJ1N0b3AgU2ltdWxhdGlvbicsXG5cbiAgLy8gTm9kZSBkcmFnZ2luZyBtZXNzYWdlIHR5cGVzXG4gIFN0YXJ0RHJhZ05vZGUgPSAnU3RhcnQgRHJhZyBOb2RlJyxcbiAgRHJhZ05vZGUgPSAnRHJhZyBOb2RlJyxcbiAgRW5kRHJhZ05vZGUgPSAnRW5kIERyYWcgTm9kZScsXG4gIEZpeE5vZGVzID0gJ0ZpeCBOb2RlcycsXG4gIFJlbGVhc2VOb2RlcyA9ICdSZWxlYXNlIE5vZGVzJyxcblxuICAvLyBTZXR0aW5ncyBhbmQgc3BlY2lhbCBwYXJhbXNcbiAgU2V0U2V0dGluZ3MgPSAnU2V0IFNldHRpbmdzJyxcbn1cblxudHlwZSBJV29ya2VySW5wdXRTZXREYXRhUGF5bG9hZCA9IElXb3JrZXJQYXlsb2FkPFxuICBXb3JrZXJJbnB1dFR5cGUuU2V0RGF0YSxcbiAge1xuICAgIG5vZGVzOiBJU2ltdWxhdGlvbk5vZGVbXTtcbiAgICBlZGdlczogSVNpbXVsYXRpb25FZGdlW107XG4gIH1cbj47XG5cbnR5cGUgSVdvcmtlcklucHV0QWRkRGF0YVBheWxvYWQgPSBJV29ya2VyUGF5bG9hZDxcbiAgV29ya2VySW5wdXRUeXBlLkFkZERhdGEsXG4gIHtcbiAgICBub2RlczogSVNpbXVsYXRpb25Ob2RlW107XG4gICAgZWRnZXM6IElTaW11bGF0aW9uRWRnZVtdO1xuICB9XG4+O1xuXG50eXBlIElXb3JrZXJJbnB1dFVwZGF0ZURhdGFQYXlsb2FkID0gSVdvcmtlclBheWxvYWQ8XG4gIFdvcmtlcklucHV0VHlwZS5VcGRhdGVEYXRhLFxuICB7XG4gICAgbm9kZXM6IElTaW11bGF0aW9uTm9kZVtdO1xuICAgIGVkZ2VzOiBJU2ltdWxhdGlvbkVkZ2VbXTtcbiAgfVxuPjtcblxudHlwZSBJV29ya2VySW5wdXRDbGVhckRhdGFQYXlsb2FkID0gSVdvcmtlclBheWxvYWQ8V29ya2VySW5wdXRUeXBlLkNsZWFyRGF0YT47XG5cbnR5cGUgSVdvcmtlcklucHV0U2ltdWxhdGVQYXlsb2FkID0gSVdvcmtlclBheWxvYWQ8V29ya2VySW5wdXRUeXBlLlNpbXVsYXRlPjtcblxudHlwZSBJV29ya2VySW5wdXRBY3RpdmF0ZVNpbXVsYXRpb25QYXlsb2FkID0gSVdvcmtlclBheWxvYWQ8V29ya2VySW5wdXRUeXBlLkFjdGl2YXRlU2ltdWxhdGlvbj47XG5cbnR5cGUgSVdvcmtlcklucHV0U3RhcnRTaW11bGF0aW9uUGF5bG9hZCA9IElXb3JrZXJQYXlsb2FkPFxuICBXb3JrZXJJbnB1dFR5cGUuU3RhcnRTaW11bGF0aW9uLFxuICB7XG4gICAgbm9kZXM6IElTaW11bGF0aW9uTm9kZVtdO1xuICAgIGVkZ2VzOiBJU2ltdWxhdGlvbkVkZ2VbXTtcbiAgfVxuPjtcblxudHlwZSBJV29ya2VySW5wdXRVcGRhdGVTaW11bGF0aW9uUGF5bG9hZCA9IElXb3JrZXJQYXlsb2FkPFxuICBXb3JrZXJJbnB1dFR5cGUuVXBkYXRlU2ltdWxhdGlvbixcbiAge1xuICAgIG5vZGVzOiBJU2ltdWxhdGlvbk5vZGVbXTtcbiAgICBlZGdlczogSVNpbXVsYXRpb25FZGdlW107XG4gIH1cbj47XG5cbnR5cGUgSVdvcmtlcklucHV0U3RvcFNpbXVsYXRpb25QYXlsb2FkID0gSVdvcmtlclBheWxvYWQ8V29ya2VySW5wdXRUeXBlLlN0b3BTaW11bGF0aW9uPjtcblxudHlwZSBJV29ya2VySW5wdXRTdGFydERyYWdOb2RlUGF5bG9hZCA9IElXb3JrZXJQYXlsb2FkPFdvcmtlcklucHV0VHlwZS5TdGFydERyYWdOb2RlPjtcblxudHlwZSBJV29ya2VySW5wdXREcmFnTm9kZVBheWxvYWQgPSBJV29ya2VyUGF5bG9hZDxXb3JrZXJJbnB1dFR5cGUuRHJhZ05vZGUsIHsgaWQ6IG51bWJlciB9ICYgSVBvc2l0aW9uPjtcblxudHlwZSBJV29ya2VySW5wdXRFbmREcmFnTm9kZVBheWxvYWQgPSBJV29ya2VyUGF5bG9hZDxcbiAgV29ya2VySW5wdXRUeXBlLkVuZERyYWdOb2RlLFxuICB7XG4gICAgaWQ6IG51bWJlcjtcbiAgfVxuPjtcblxudHlwZSBJV29ya2VySW5wdXRGaXhOb2Rlc1BheWxvYWQgPSBJV29ya2VyUGF5bG9hZDxcbiAgV29ya2VySW5wdXRUeXBlLkZpeE5vZGVzLFxuICB7XG4gICAgbm9kZXM6IElTaW11bGF0aW9uTm9kZVtdIHwgdW5kZWZpbmVkO1xuICB9XG4+O1xuXG50eXBlIElXb3JrZXJJbnB1dFJlbGVhc2VOb2Rlc1BheWxvYWQgPSBJV29ya2VyUGF5bG9hZDxcbiAgV29ya2VySW5wdXRUeXBlLlJlbGVhc2VOb2RlcyxcbiAge1xuICAgIG5vZGVzOiBJU2ltdWxhdGlvbk5vZGVbXSB8IHVuZGVmaW5lZDtcbiAgfVxuPjtcblxudHlwZSBJV29ya2VySW5wdXRTZXRTZXR0aW5nc1BheWxvYWQgPSBJV29ya2VyUGF5bG9hZDxXb3JrZXJJbnB1dFR5cGUuU2V0U2V0dGluZ3MsIElEM1NpbXVsYXRvckVuZ2luZVNldHRpbmdzVXBkYXRlPjtcblxuZXhwb3J0IHR5cGUgSVdvcmtlcklucHV0UGF5bG9hZCA9XG4gIHwgSVdvcmtlcklucHV0U2V0RGF0YVBheWxvYWRcbiAgfCBJV29ya2VySW5wdXRBZGREYXRhUGF5bG9hZFxuICB8IElXb3JrZXJJbnB1dFVwZGF0ZURhdGFQYXlsb2FkXG4gIHwgSVdvcmtlcklucHV0Q2xlYXJEYXRhUGF5bG9hZFxuICB8IElXb3JrZXJJbnB1dFNpbXVsYXRlUGF5bG9hZFxuICB8IElXb3JrZXJJbnB1dEFjdGl2YXRlU2ltdWxhdGlvblBheWxvYWRcbiAgfCBJV29ya2VySW5wdXRTdGFydFNpbXVsYXRpb25QYXlsb2FkXG4gIHwgSVdvcmtlcklucHV0VXBkYXRlU2ltdWxhdGlvblBheWxvYWRcbiAgfCBJV29ya2VySW5wdXRTdG9wU2ltdWxhdGlvblBheWxvYWRcbiAgfCBJV29ya2VySW5wdXRTdGFydERyYWdOb2RlUGF5bG9hZFxuICB8IElXb3JrZXJJbnB1dERyYWdOb2RlUGF5bG9hZFxuICB8IElXb3JrZXJJbnB1dEZpeE5vZGVzUGF5bG9hZFxuICB8IElXb3JrZXJJbnB1dFJlbGVhc2VOb2Rlc1BheWxvYWRcbiAgfCBJV29ya2VySW5wdXRFbmREcmFnTm9kZVBheWxvYWRcbiAgfCBJV29ya2VySW5wdXRTZXRTZXR0aW5nc1BheWxvYWQ7XG4iLCJpbXBvcnQgeyBJU2ltdWxhdGlvbk5vZGUsIElTaW11bGF0aW9uRWRnZSB9IGZyb20gJy4uLy4uLy4uL3NoYXJlZCc7XG5pbXBvcnQgeyBJV29ya2VyUGF5bG9hZCB9IGZyb20gJy4vd29ya2VyLXBheWxvYWQnO1xuaW1wb3J0IHsgSUQzU2ltdWxhdG9yRW5naW5lU2V0dGluZ3MgfSBmcm9tICcuLi8uLi8uLi9lbmdpbmUvZDMtc2ltdWxhdG9yLWVuZ2luZSc7XG5cbmV4cG9ydCBlbnVtIFdvcmtlck91dHB1dFR5cGUge1xuICBTSU1VTEFUSU9OX1NUQVJUID0gJ3NpbXVsYXRpb24tc3RhcnQnLFxuICBTSU1VTEFUSU9OX1BST0dSRVNTID0gJ3NpbXVsYXRpb24tcHJvZ3Jlc3MnLFxuICBTSU1VTEFUSU9OX0VORCA9ICdzaW11bGF0aW9uLWVuZCcsXG4gIE5PREVfRFJBRyA9ICdub2RlLWRyYWcnLFxuICBOT0RFX0RSQUdfRU5EID0gJ25vZGUtZHJhZy1lbmQnLFxuICBTRVRUSU5HU19VUERBVEUgPSAnc2V0dGluZ3MtdXBkYXRlJyxcbn1cblxudHlwZSBJV29ya2VyT3V0cHV0U2ltdWxhdGlvblN0YXJ0UGF5bG9hZCA9IElXb3JrZXJQYXlsb2FkPFdvcmtlck91dHB1dFR5cGUuU0lNVUxBVElPTl9TVEFSVD47XG5cbnR5cGUgSVdvcmtlck91dHB1dFNpbXVsYXRpb25Qcm9ncmVzc1BheWxvYWQgPSBJV29ya2VyUGF5bG9hZDxcbiAgV29ya2VyT3V0cHV0VHlwZS5TSU1VTEFUSU9OX1BST0dSRVNTLFxuICB7XG4gICAgbm9kZXM6IElTaW11bGF0aW9uTm9kZVtdO1xuICAgIGVkZ2VzOiBJU2ltdWxhdGlvbkVkZ2VbXTtcbiAgICBwcm9ncmVzczogbnVtYmVyO1xuICB9XG4+O1xuXG50eXBlIElXb3JrZXJPdXRwdXRTaW11bGF0aW9uRW5kUGF5bG9hZCA9IElXb3JrZXJQYXlsb2FkPFxuICBXb3JrZXJPdXRwdXRUeXBlLlNJTVVMQVRJT05fRU5ELFxuICB7XG4gICAgbm9kZXM6IElTaW11bGF0aW9uTm9kZVtdO1xuICAgIGVkZ2VzOiBJU2ltdWxhdGlvbkVkZ2VbXTtcbiAgfVxuPjtcblxudHlwZSBJV29ya2VyT3V0cHV0Tm9kZURyYWdQYXlsb2FkID0gSVdvcmtlclBheWxvYWQ8XG4gIFdvcmtlck91dHB1dFR5cGUuTk9ERV9EUkFHLFxuICB7XG4gICAgbm9kZXM6IElTaW11bGF0aW9uTm9kZVtdO1xuICAgIGVkZ2VzOiBJU2ltdWxhdGlvbkVkZ2VbXTtcbiAgfVxuPjtcblxudHlwZSBJV29ya2VyT3V0cHV0Tm9kZURyYWdFbmRQYXlsb2FkID0gSVdvcmtlclBheWxvYWQ8XG4gIFdvcmtlck91dHB1dFR5cGUuTk9ERV9EUkFHX0VORCxcbiAge1xuICAgIG5vZGVzOiBJU2ltdWxhdGlvbk5vZGVbXTtcbiAgICBlZGdlczogSVNpbXVsYXRpb25FZGdlW107XG4gIH1cbj47XG5cbnR5cGUgSVdvcmtlck91dHB1dFNldHRpbmdzVXBkYXRlUGF5bG9hZCA9IElXb3JrZXJQYXlsb2FkPFxuICBXb3JrZXJPdXRwdXRUeXBlLlNFVFRJTkdTX1VQREFURSxcbiAge1xuICAgIHNldHRpbmdzOiBJRDNTaW11bGF0b3JFbmdpbmVTZXR0aW5ncztcbiAgfVxuPjtcblxuZXhwb3J0IHR5cGUgSVdvcmtlck91dHB1dFBheWxvYWQgPVxuICB8IElXb3JrZXJPdXRwdXRTaW11bGF0aW9uU3RhcnRQYXlsb2FkXG4gIHwgSVdvcmtlck91dHB1dFNpbXVsYXRpb25Qcm9ncmVzc1BheWxvYWRcbiAgfCBJV29ya2VyT3V0cHV0U2ltdWxhdGlvbkVuZFBheWxvYWRcbiAgfCBJV29ya2VyT3V0cHV0Tm9kZURyYWdQYXlsb2FkXG4gIHwgSVdvcmtlck91dHB1dE5vZGVEcmFnRW5kUGF5bG9hZFxuICB8IElXb3JrZXJPdXRwdXRTZXR0aW5nc1VwZGF0ZVBheWxvYWQ7XG4iLCIvLyAvIDxyZWZlcmVuY2UgbGliPVwid2Vid29ya2VyXCIgLz5cbmltcG9ydCB7IEQzU2ltdWxhdG9yRW5naW5lLCBEM1NpbXVsYXRvckVuZ2luZUV2ZW50VHlwZSB9IGZyb20gJy4uLy4uL2VuZ2luZS9kMy1zaW11bGF0b3ItZW5naW5lJztcbmltcG9ydCB7IElXb3JrZXJJbnB1dFBheWxvYWQsIFdvcmtlcklucHV0VHlwZSB9IGZyb20gJy4vbWVzc2FnZS93b3JrZXItaW5wdXQnO1xuaW1wb3J0IHsgSVdvcmtlck91dHB1dFBheWxvYWQsIFdvcmtlck91dHB1dFR5cGUgfSBmcm9tICcuL21lc3NhZ2Uvd29ya2VyLW91dHB1dCc7XG5cbmNvbnN0IHNpbXVsYXRvciA9IG5ldyBEM1NpbXVsYXRvckVuZ2luZSgpO1xuXG5jb25zdCBlbWl0VG9NYWluID0gKG1lc3NhZ2U6IElXb3JrZXJPdXRwdXRQYXlsb2FkKSA9PiB7XG4gIC8vIEB0cy1pZ25vcmUgV2ViIHdvcmtlciBwb3N0TWVzc2FnZSBpcyBhIGdsb2JhbCBmdW5jdGlvblxuICBwb3N0TWVzc2FnZShtZXNzYWdlKTtcbn07XG5cbnNpbXVsYXRvci5vbihEM1NpbXVsYXRvckVuZ2luZUV2ZW50VHlwZS5USUNLLCAoZGF0YSkgPT4ge1xuICBlbWl0VG9NYWluKHsgdHlwZTogV29ya2VyT3V0cHV0VHlwZS5OT0RFX0RSQUcsIGRhdGEgfSk7XG59KTtcblxuc2ltdWxhdG9yLm9uKEQzU2ltdWxhdG9yRW5naW5lRXZlbnRUeXBlLkVORCwgKGRhdGEpID0+IHtcbiAgZW1pdFRvTWFpbih7IHR5cGU6IFdvcmtlck91dHB1dFR5cGUuTk9ERV9EUkFHX0VORCwgZGF0YSB9KTtcbn0pO1xuXG5zaW11bGF0b3Iub24oRDNTaW11bGF0b3JFbmdpbmVFdmVudFR5cGUuU0lNVUxBVElPTl9TVEFSVCwgKCkgPT4ge1xuICBlbWl0VG9NYWluKHsgdHlwZTogV29ya2VyT3V0cHV0VHlwZS5TSU1VTEFUSU9OX1NUQVJUIH0pO1xufSk7XG5cbnNpbXVsYXRvci5vbihEM1NpbXVsYXRvckVuZ2luZUV2ZW50VHlwZS5TSU1VTEFUSU9OX1BST0dSRVNTLCAoZGF0YSkgPT4ge1xuICBlbWl0VG9NYWluKHsgdHlwZTogV29ya2VyT3V0cHV0VHlwZS5TSU1VTEFUSU9OX1BST0dSRVNTLCBkYXRhIH0pO1xufSk7XG5cbnNpbXVsYXRvci5vbihEM1NpbXVsYXRvckVuZ2luZUV2ZW50VHlwZS5TSU1VTEFUSU9OX0VORCwgKGRhdGEpID0+IHtcbiAgZW1pdFRvTWFpbih7IHR5cGU6IFdvcmtlck91dHB1dFR5cGUuU0lNVUxBVElPTl9FTkQsIGRhdGEgfSk7XG59KTtcblxuc2ltdWxhdG9yLm9uKEQzU2ltdWxhdG9yRW5naW5lRXZlbnRUeXBlLk5PREVfRFJBRywgKGRhdGEpID0+IHtcbiAgLy8gTm90aWZ5IHRoZSBjbGllbnQgdGhhdCB0aGUgbm9kZSBwb3NpdGlvbiBjaGFuZ2VkLlxuICAvLyBUaGlzIGlzIG90aGVyd2lzZSBoYW5kbGVkIGJ5IHRoZSBzaW11bGF0aW9uIHRpY2sgaWYgcGh5c2ljcyBpcyBlbmFibGVkLlxuICBlbWl0VG9NYWluKHsgdHlwZTogV29ya2VyT3V0cHV0VHlwZS5OT0RFX0RSQUcsIGRhdGEgfSk7XG59KTtcblxuc2ltdWxhdG9yLm9uKEQzU2ltdWxhdG9yRW5naW5lRXZlbnRUeXBlLlNFVFRJTkdTX1VQREFURSwgKGRhdGEpID0+IHtcbiAgZW1pdFRvTWFpbih7IHR5cGU6IFdvcmtlck91dHB1dFR5cGUuU0VUVElOR1NfVVBEQVRFLCBkYXRhIH0pO1xufSk7XG5cbmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCAoeyBkYXRhIH06IE1lc3NhZ2VFdmVudDxJV29ya2VySW5wdXRQYXlsb2FkPikgPT4ge1xuICBzd2l0Y2ggKGRhdGEudHlwZSkge1xuICAgIGNhc2UgV29ya2VySW5wdXRUeXBlLkFjdGl2YXRlU2ltdWxhdGlvbjoge1xuICAgICAgc2ltdWxhdG9yLmFjdGl2YXRlU2ltdWxhdGlvbigpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgY2FzZSBXb3JrZXJJbnB1dFR5cGUuU2V0RGF0YToge1xuICAgICAgc2ltdWxhdG9yLnNldERhdGEoZGF0YS5kYXRhKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGNhc2UgV29ya2VySW5wdXRUeXBlLkFkZERhdGE6IHtcbiAgICAgIHNpbXVsYXRvci5hZGREYXRhKGRhdGEuZGF0YSk7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjYXNlIFdvcmtlcklucHV0VHlwZS5VcGRhdGVEYXRhOiB7XG4gICAgICBzaW11bGF0b3IudXBkYXRlRGF0YShkYXRhLmRhdGEpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgY2FzZSBXb3JrZXJJbnB1dFR5cGUuQ2xlYXJEYXRhOiB7XG4gICAgICBzaW11bGF0b3IuY2xlYXJEYXRhKCk7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjYXNlIFdvcmtlcklucHV0VHlwZS5TaW11bGF0ZToge1xuICAgICAgc2ltdWxhdG9yLnNpbXVsYXRlKCk7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjYXNlIFdvcmtlcklucHV0VHlwZS5TdGFydFNpbXVsYXRpb246IHtcbiAgICAgIHNpbXVsYXRvci5zdGFydFNpbXVsYXRpb24oZGF0YS5kYXRhKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGNhc2UgV29ya2VySW5wdXRUeXBlLlVwZGF0ZVNpbXVsYXRpb246IHtcbiAgICAgIHNpbXVsYXRvci51cGRhdGVTaW11bGF0aW9uKGRhdGEuZGF0YSk7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjYXNlIFdvcmtlcklucHV0VHlwZS5TdG9wU2ltdWxhdGlvbjoge1xuICAgICAgc2ltdWxhdG9yLnN0b3BTaW11bGF0aW9uKCk7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjYXNlIFdvcmtlcklucHV0VHlwZS5TdGFydERyYWdOb2RlOiB7XG4gICAgICBzaW11bGF0b3Iuc3RhcnREcmFnTm9kZSgpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgY2FzZSBXb3JrZXJJbnB1dFR5cGUuRHJhZ05vZGU6IHtcbiAgICAgIHNpbXVsYXRvci5kcmFnTm9kZShkYXRhLmRhdGEpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgY2FzZSBXb3JrZXJJbnB1dFR5cGUuRml4Tm9kZXM6IHtcbiAgICAgIHNpbXVsYXRvci5maXhOb2RlcyhkYXRhLmRhdGEubm9kZXMpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgY2FzZSBXb3JrZXJJbnB1dFR5cGUuUmVsZWFzZU5vZGVzOiB7XG4gICAgICBzaW11bGF0b3IucmVsZWFzZU5vZGVzKGRhdGEuZGF0YS5ub2Rlcyk7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjYXNlIFdvcmtlcklucHV0VHlwZS5FbmREcmFnTm9kZToge1xuICAgICAgc2ltdWxhdG9yLmVuZERyYWdOb2RlKGRhdGEuZGF0YSk7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjYXNlIFdvcmtlcklucHV0VHlwZS5TZXRTZXR0aW5nczoge1xuICAgICAgc2ltdWxhdG9yLnNldFNldHRpbmdzKGRhdGEuZGF0YSk7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbn0pO1xuIiwiLy8gUmVmZXJlbmNlOiBodHRwczovL3JqemF3b3Jza2kuY29tLzIwMTkvMTAvZXZlbnQtZW1pdHRlcnMtaW4tdHlwZXNjcmlwdFxuZXhwb3J0IHR5cGUgSUV2ZW50TWFwID0gUmVjb3JkPHN0cmluZywgYW55PjtcbnR5cGUgSUV2ZW50S2V5PFQgZXh0ZW5kcyBJRXZlbnRNYXA+ID0gc3RyaW5nICYga2V5b2YgVDtcbnR5cGUgSUV2ZW50UmVjZWl2ZXI8VD4gPSAocGFyYW1zOiBUKSA9PiB2b2lkO1xuXG5leHBvcnQgaW50ZXJmYWNlIElFbWl0dGVyPFQgZXh0ZW5kcyBJRXZlbnRNYXA+IHtcbiAgb25jZTxLIGV4dGVuZHMgSUV2ZW50S2V5PFQ+PihldmVudE5hbWU6IEssIGZ1bmM6IElFdmVudFJlY2VpdmVyPFRbS10+KTogSUVtaXR0ZXI8VD47XG4gIG9uPEsgZXh0ZW5kcyBJRXZlbnRLZXk8VD4+KGV2ZW50TmFtZTogSywgZnVuYzogSUV2ZW50UmVjZWl2ZXI8VFtLXT4pOiBJRW1pdHRlcjxUPjtcbiAgb2ZmPEsgZXh0ZW5kcyBJRXZlbnRLZXk8VD4+KGV2ZW50TmFtZTogSywgZnVuYzogSUV2ZW50UmVjZWl2ZXI8VFtLXT4pOiBJRW1pdHRlcjxUPjtcbiAgZW1pdDxLIGV4dGVuZHMgSUV2ZW50S2V5PFQ+PihldmVudE5hbWU6IEssIHBhcmFtczogVFtLXSk6IGJvb2xlYW47XG4gIGV2ZW50TmFtZXM8SyBleHRlbmRzIElFdmVudEtleTxUPj4oKTogS1tdO1xuICBsaXN0ZW5lckNvdW50PEsgZXh0ZW5kcyBJRXZlbnRLZXk8VD4+KGV2ZW50TmFtZTogSyk6IG51bWJlcjtcbiAgbGlzdGVuZXJzPEsgZXh0ZW5kcyBJRXZlbnRLZXk8VD4+KGV2ZW50TmFtZTogSyk6IElFdmVudFJlY2VpdmVyPFRbS10+W107XG4gIGFkZExpc3RlbmVyPEsgZXh0ZW5kcyBJRXZlbnRLZXk8VD4+KGV2ZW50TmFtZTogSywgZnVuYzogSUV2ZW50UmVjZWl2ZXI8VFtLXT4pOiBJRW1pdHRlcjxUPjtcbiAgcmVtb3ZlTGlzdGVuZXI8SyBleHRlbmRzIElFdmVudEtleTxUPj4oZXZlbnROYW1lOiBLLCBmdW5jOiBJRXZlbnRSZWNlaXZlcjxUW0tdPik6IElFbWl0dGVyPFQ+O1xuICByZW1vdmVBbGxMaXN0ZW5lcnM8SyBleHRlbmRzIElFdmVudEtleTxUPj4oZXZlbnROYW1lPzogSyk6IElFbWl0dGVyPFQ+O1xufVxuXG5pbnRlcmZhY2UgSUVtaXR0ZXJMaXN0ZW5lcjxUIGV4dGVuZHMgSUV2ZW50TWFwPiB7XG4gIGNhbGxhYmxlOiBJRXZlbnRSZWNlaXZlcjxUW2FueV0+O1xuICBpc09uY2U/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgRW1pdHRlcjxUIGV4dGVuZHMgSUV2ZW50TWFwPiBpbXBsZW1lbnRzIElFbWl0dGVyPFQ+IHtcbiAgcHJpdmF0ZSByZWFkb25seSBfbGlzdGVuZXJzID0gbmV3IE1hcDxJRXZlbnRLZXk8VD4sIElFbWl0dGVyTGlzdGVuZXI8VD5bXT4oKTtcblxuICAvKipcbiAgICogQWRkcyBhIG9uZS10aW1lIGxpc3RlbmVyIGZ1bmN0aW9uIGZvciB0aGUgZXZlbnQgbmFtZWQgZXZlbnROYW1lLiBUaGUgbmV4dCB0aW1lIGV2ZW50TmFtZSBpc1xuICAgKiB0cmlnZ2VyZWQsIHRoaXMgbGlzdGVuZXIgaXMgcmVtb3ZlZCBhbmQgdGhlbiBpbnZva2VkLlxuICAgKlxuICAgKiBAc2VlIHtAbGluayBodHRwczovL25vZGVqcy5vcmcvYXBpL2V2ZW50cy5odG1sI2VtaXR0ZXJvbmNlZXZlbnRuYW1lLWxpc3RlbmVyfVxuICAgKiBAcGFyYW0ge0lFdmVudEtleX0gZXZlbnROYW1lIEV2ZW50IG5hbWVcbiAgICogQHBhcmFtIHtJRXZlbnRSZWNlaXZlcn0gZnVuYyBFdmVudCBmdW5jdGlvblxuICAgKiBAcmV0dXJuIHtJRW1pdHRlcn0gUmVmZXJlbmNlIHRvIHRoZSBFdmVudEVtaXR0ZXIsIHNvIHRoYXQgY2FsbHMgY2FuIGJlIGNoYWluZWRcbiAgICovXG4gIG9uY2U8SyBleHRlbmRzIElFdmVudEtleTxUPj4oZXZlbnROYW1lOiBLLCBmdW5jOiBJRXZlbnRSZWNlaXZlcjxUW0tdPik6IElFbWl0dGVyPFQ+IHtcbiAgICBjb25zdCBuZXdMaXN0ZW5lcjogSUVtaXR0ZXJMaXN0ZW5lcjxUPiA9IHtcbiAgICAgIGNhbGxhYmxlOiBmdW5jLFxuICAgICAgaXNPbmNlOiB0cnVlLFxuICAgIH07XG5cbiAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnMuZ2V0KGV2ZW50TmFtZSk7XG4gICAgaWYgKGxpc3RlbmVycykge1xuICAgICAgbGlzdGVuZXJzLnB1c2gobmV3TGlzdGVuZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9saXN0ZW5lcnMuc2V0KGV2ZW50TmFtZSwgW25ld0xpc3RlbmVyXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyB0aGUgbGlzdGVuZXIgZnVuY3Rpb24gdG8gdGhlIGVuZCBvZiB0aGUgbGlzdGVuZXJzIGFycmF5IGZvciB0aGUgZXZlbnQgbmFtZWQgZXZlbnROYW1lLlxuICAgKiBObyBjaGVja3MgYXJlIG1hZGUgdG8gc2VlIGlmIHRoZSBsaXN0ZW5lciBoYXMgYWxyZWFkeSBiZWVuIGFkZGVkLiBNdWx0aXBsZSBjYWxscyBwYXNzaW5nXG4gICAqIHRoZSBzYW1lIGNvbWJpbmF0aW9uIG9mIGV2ZW50TmFtZSBhbmQgbGlzdGVuZXIgd2lsbCByZXN1bHQgaW4gdGhlIGxpc3RlbmVyIGJlaW5nIGFkZGVkLFxuICAgKiBhbmQgY2FsbGVkLCBtdWx0aXBsZSB0aW1lcy5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9ldmVudHMuaHRtbCNlbWl0dGVyb25ldmVudG5hbWUtbGlzdGVuZXJ9XG4gICAqIEBwYXJhbSB7SUV2ZW50S2V5fSBldmVudE5hbWUgRXZlbnQgbmFtZVxuICAgKiBAcGFyYW0ge0lFdmVudFJlY2VpdmVyfSBmdW5jIEV2ZW50IGZ1bmN0aW9uXG4gICAqIEByZXR1cm4ge0lFbWl0dGVyfSBSZWZlcmVuY2UgdG8gdGhlIEV2ZW50RW1pdHRlciwgc28gdGhhdCBjYWxscyBjYW4gYmUgY2hhaW5lZFxuICAgKi9cbiAgb248SyBleHRlbmRzIElFdmVudEtleTxUPj4oZXZlbnROYW1lOiBLLCBmdW5jOiBJRXZlbnRSZWNlaXZlcjxUW0tdPik6IElFbWl0dGVyPFQ+IHtcbiAgICBjb25zdCBuZXdMaXN0ZW5lcjogSUVtaXR0ZXJMaXN0ZW5lcjxUPiA9IHtcbiAgICAgIGNhbGxhYmxlOiBmdW5jLFxuICAgIH07XG5cbiAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnMuZ2V0KGV2ZW50TmFtZSk7XG4gICAgaWYgKGxpc3RlbmVycykge1xuICAgICAgbGlzdGVuZXJzLnB1c2gobmV3TGlzdGVuZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9saXN0ZW5lcnMuc2V0KGV2ZW50TmFtZSwgW25ld0xpc3RlbmVyXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyB0aGUgc3BlY2lmaWVkIGxpc3RlbmVyIGZyb20gdGhlIGxpc3RlbmVyIGFycmF5IGZvciB0aGUgZXZlbnQgbmFtZWQgZXZlbnROYW1lLlxuICAgKlxuICAgKiBAc2VlIHtAbGluayBodHRwczovL25vZGVqcy5vcmcvYXBpL2V2ZW50cy5odG1sI2VtaXR0ZXJyZW1vdmVsaXN0ZW5lcmV2ZW50bmFtZS1saXN0ZW5lcn1cbiAgICogQHBhcmFtIHtJRXZlbnRLZXl9IGV2ZW50TmFtZSBFdmVudCBuYW1lXG4gICAqIEBwYXJhbSB7SUV2ZW50UmVjZWl2ZXJ9IGZ1bmMgRXZlbnQgZnVuY3Rpb25cbiAgICogQHJldHVybiB7SUVtaXR0ZXJ9IFJlZmVyZW5jZSB0byB0aGUgRXZlbnRFbWl0dGVyLCBzbyB0aGF0IGNhbGxzIGNhbiBiZSBjaGFpbmVkXG4gICAqL1xuICBvZmY8SyBleHRlbmRzIElFdmVudEtleTxUPj4oZXZlbnROYW1lOiBLLCBmdW5jOiBJRXZlbnRSZWNlaXZlcjxUW0tdPik6IElFbWl0dGVyPFQ+IHtcbiAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnMuZ2V0KGV2ZW50TmFtZSk7XG4gICAgaWYgKGxpc3RlbmVycykge1xuICAgICAgY29uc3QgZmlsdGVyZWRMaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuZmlsdGVyKChsaXN0ZW5lcikgPT4gbGlzdGVuZXIuY2FsbGFibGUgIT09IGZ1bmMpO1xuICAgICAgdGhpcy5fbGlzdGVuZXJzLnNldChldmVudE5hbWUsIGZpbHRlcmVkTGlzdGVuZXJzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91c2x5IGNhbGxzIGVhY2ggb2YgdGhlIGxpc3RlbmVycyByZWdpc3RlcmVkIGZvciB0aGUgZXZlbnQgbmFtZWQgZXZlbnROYW1lLFxuICAgKiBpbiB0aGUgb3JkZXIgdGhleSB3ZXJlIHJlZ2lzdGVyZWQsIHBhc3NpbmcgdGhlIHN1cHBsaWVkIGFyZ3VtZW50cyB0byBlYWNoLlxuICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGV2ZW50IGhhZCBsaXN0ZW5lcnMsIGZhbHNlIG90aGVyd2lzZS5cbiAgICpcbiAgICogQHBhcmFtIHtJRXZlbnRLZXl9IGV2ZW50TmFtZSBFdmVudCBuYW1lXG4gICAqIEBwYXJhbSB7YW55fSBwYXJhbXMgRXZlbnQgcGFyYW1ldGVyc1xuICAgKlxuICAgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIHRoZSBldmVudCBoYWQgbGlzdGVuZXJzLCBmYWxzZSBvdGhlcndpc2VcbiAgICovXG4gIGVtaXQ8SyBleHRlbmRzIElFdmVudEtleTxUPj4oZXZlbnROYW1lOiBLLCBwYXJhbXM6IFRbS10pOiBib29sZWFuIHtcbiAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnMuZ2V0KGV2ZW50TmFtZSk7XG4gICAgaWYgKCFsaXN0ZW5lcnMgfHwgbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGxldCBoYXNPbmNlTGlzdGVuZXIgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGxpc3RlbmVyc1tpXS5pc09uY2UpIHtcbiAgICAgICAgaGFzT25jZUxpc3RlbmVyID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGxpc3RlbmVyc1tpXS5jYWxsYWJsZShwYXJhbXMpO1xuICAgIH1cblxuICAgIGlmIChoYXNPbmNlTGlzdGVuZXIpIHtcbiAgICAgIGNvbnN0IGZpbHRlcmVkTGlzdGVuZXJzID0gbGlzdGVuZXJzLmZpbHRlcigobGlzdGVuZXIpID0+ICFsaXN0ZW5lci5pc09uY2UpO1xuICAgICAgdGhpcy5fbGlzdGVuZXJzLnNldChldmVudE5hbWUsIGZpbHRlcmVkTGlzdGVuZXJzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhbiBhcnJheSBsaXN0aW5nIHRoZSBldmVudHMgZm9yIHdoaWNoIHRoZSBlbWl0dGVyIGhhcyByZWdpc3RlcmVkIGxpc3RlbmVycy5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9ldmVudHMuaHRtbCNlbWl0dGVyZXZlbnRuYW1lc31cbiAgICogQHJldHVybiB7SUV2ZW50S2V5W119IEV2ZW50IG5hbWVzIHdpdGggcmVnaXN0ZXJlZCBsaXN0ZW5lcnNcbiAgICovXG4gIGV2ZW50TmFtZXM8SyBleHRlbmRzIElFdmVudEtleTxUPj4oKTogS1tdIHtcbiAgICByZXR1cm4gWy4uLnRoaXMuX2xpc3RlbmVycy5rZXlzKCldIGFzIEtbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBudW1iZXIgb2YgbGlzdGVuZXJzIGxpc3RlbmluZyB0byB0aGUgZXZlbnQgbmFtZWQgZXZlbnROYW1lLlxuICAgKlxuICAgKiBAc2VlIHtAbGluayBodHRwczovL25vZGVqcy5vcmcvYXBpL2V2ZW50cy5odG1sI2VtaXR0ZXJsaXN0ZW5lcmNvdW50ZXZlbnRuYW1lfVxuICAgKiBAcGFyYW0ge0lFdmVudEtleX0gZXZlbnROYW1lIEV2ZW50IG5hbWVcbiAgICogQHJldHVybiB7bnVtYmVyfSBOdW1iZXIgb2YgbGlzdGVuZXJzIGxpc3RlbmluZyB0byB0aGUgZXZlbnQgbmFtZVxuICAgKi9cbiAgbGlzdGVuZXJDb3VudDxLIGV4dGVuZHMgSUV2ZW50S2V5PFQ+PihldmVudE5hbWU6IEspOiBudW1iZXIge1xuICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycy5nZXQoZXZlbnROYW1lKTtcbiAgICByZXR1cm4gbGlzdGVuZXJzID8gbGlzdGVuZXJzLmxlbmd0aCA6IDA7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIGNvcHkgb2YgdGhlIGFycmF5IG9mIGxpc3RlbmVycyBmb3IgdGhlIGV2ZW50IG5hbWVkIGV2ZW50TmFtZS5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9ldmVudHMuaHRtbCNlbWl0dGVybGlzdGVuZXJzZXZlbnRuYW1lfVxuICAgKiBAcGFyYW0ge0lFdmVudEtleX0gZXZlbnROYW1lIEV2ZW50IG5hbWVcbiAgICogQHJldHVybiB7SUV2ZW50UmVjZWl2ZXJbXX0gQXJyYXkgb2YgbGlzdGVuZXJzIGZvciB0aGUgZXZlbnQgbmFtZVxuICAgKi9cbiAgbGlzdGVuZXJzPEsgZXh0ZW5kcyBJRXZlbnRLZXk8VD4+KGV2ZW50TmFtZTogSyk6IElFdmVudFJlY2VpdmVyPFRbS10+W10ge1xuICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycy5nZXQoZXZlbnROYW1lKTtcbiAgICBpZiAoIWxpc3RlbmVycykge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICByZXR1cm4gbGlzdGVuZXJzLm1hcCgobGlzdGVuZXIpID0+IGxpc3RlbmVyLmNhbGxhYmxlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBbGlhcyBmb3IgZW1pdHRlci5vbihldmVudE5hbWUsIGxpc3RlbmVyKS5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9ldmVudHMuaHRtbCNlbWl0dGVyYWRkbGlzdGVuZXJldmVudG5hbWUtbGlzdGVuZXJ9XG4gICAqIEBwYXJhbSB7SUV2ZW50S2V5fSBldmVudE5hbWUgRXZlbnQgbmFtZVxuICAgKiBAcGFyYW0ge0lFdmVudFJlY2VpdmVyfSBmdW5jIEV2ZW50IGZ1bmN0aW9uXG4gICAqIEByZXR1cm4ge0lFbWl0dGVyfSBSZWZlcmVuY2UgdG8gdGhlIEV2ZW50RW1pdHRlciwgc28gdGhhdCBjYWxscyBjYW4gYmUgY2hhaW5lZFxuICAgKi9cbiAgYWRkTGlzdGVuZXI8SyBleHRlbmRzIElFdmVudEtleTxUPj4oZXZlbnROYW1lOiBLLCBmdW5jOiBJRXZlbnRSZWNlaXZlcjxUW0tdPik6IElFbWl0dGVyPFQ+IHtcbiAgICByZXR1cm4gdGhpcy5vbjxLPihldmVudE5hbWUsIGZ1bmMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFsaWFzIGZvciBlbWl0dGVyLm9mZihldmVudE5hbWUsIGxpc3RlbmVyKS5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9ldmVudHMuaHRtbCNlbWl0dGVycmVtb3ZlbGlzdGVuZXJldmVudG5hbWUtbGlzdGVuZXJ9XG4gICAqIEBwYXJhbSB7SUV2ZW50S2V5fSBldmVudE5hbWUgRXZlbnQgbmFtZVxuICAgKiBAcGFyYW0ge0lFdmVudFJlY2VpdmVyfSBmdW5jIEV2ZW50IGZ1bmN0aW9uXG4gICAqIEByZXR1cm4ge0lFbWl0dGVyfSBSZWZlcmVuY2UgdG8gdGhlIEV2ZW50RW1pdHRlciwgc28gdGhhdCBjYWxscyBjYW4gYmUgY2hhaW5lZFxuICAgKi9cbiAgcmVtb3ZlTGlzdGVuZXI8SyBleHRlbmRzIElFdmVudEtleTxUPj4oZXZlbnROYW1lOiBLLCBmdW5jOiBJRXZlbnRSZWNlaXZlcjxUW0tdPik6IElFbWl0dGVyPFQ+IHtcbiAgICByZXR1cm4gdGhpcy5vZmY8Sz4oZXZlbnROYW1lLCBmdW5jKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGFsbCBsaXN0ZW5lcnMsIG9yIHRob3NlIG9mIHRoZSBzcGVjaWZpZWQgZXZlbnROYW1lLlxuICAgKlxuICAgKiBAc2VlIHtAbGluayBodHRwczovL25vZGVqcy5vcmcvYXBpL2V2ZW50cy5odG1sI2VtaXR0ZXJyZW1vdmVhbGxsaXN0ZW5lcnNldmVudG5hbWV9XG4gICAqIEBwYXJhbSB7SUV2ZW50S2V5fSBldmVudE5hbWUgRXZlbnQgbmFtZVxuICAgKiBAcmV0dXJuIHtJRW1pdHRlcn0gUmVmZXJlbmNlIHRvIHRoZSBFdmVudEVtaXR0ZXIsIHNvIHRoYXQgY2FsbHMgY2FuIGJlIGNoYWluZWRcbiAgICovXG4gIHJlbW92ZUFsbExpc3RlbmVyczxLIGV4dGVuZHMgSUV2ZW50S2V5PFQ+PihldmVudE5hbWU/OiBLKTogSUVtaXR0ZXI8VD4ge1xuICAgIGlmIChldmVudE5hbWUpIHtcbiAgICAgIHRoaXMuX2xpc3RlbmVycy5kZWxldGUoZXZlbnROYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fbGlzdGVuZXJzLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cbiIsImltcG9ydCB7IGlzQXJyYXksIGlzRGF0ZSwgaXNQbGFpbk9iamVjdCB9IGZyb20gJy4vdHlwZS51dGlscyc7XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBkZWVwIGNvcHkgb2YgdGhlIHJlY2VpdmVkIG9iamVjdC4gRGF0ZXMsIGFycmF5cyBhbmRcbiAqIHBsYWluIG9iamVjdHMgd2lsbCBiZSBjcmVhdGVkIGFzIG5ldyBvYmplY3RzIChuZXcgcmVmZXJlbmNlKS5cbiAqXG4gKiBAcGFyYW0ge2FueX0gb2JqIE9iamVjdFxuICogQHJldHVybiB7YW55fSBEZWVwIGNvcGllZCBvYmplY3RcbiAqL1xuZXhwb3J0IGNvbnN0IGNvcHlPYmplY3QgPSA8VCBleHRlbmRzIGFueVtdIHwgYW55PihvYmo6IFQpOiBUID0+IHtcbiAgaWYgKGlzRGF0ZShvYmopKSB7XG4gICAgcmV0dXJuIGNvcHlEYXRlKG9iaikgYXMgVDtcbiAgfVxuXG4gIGlmIChpc0FycmF5KG9iaikpIHtcbiAgICByZXR1cm4gY29weUFycmF5KG9iaikgYXMgVDtcbiAgfVxuXG4gIGlmIChpc1BsYWluT2JqZWN0KG9iaikpIHtcbiAgICByZXR1cm4gY29weVBsYWluT2JqZWN0KG9iaikgYXMgVDtcbiAgfVxuXG4gIC8vIEl0IGlzIGEgcHJpbWl0aXZlLCBmdW5jdGlvbiBvciBhIGN1c3RvbSBjbGFzc1xuICByZXR1cm4gb2JqO1xufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgdHdvIG9iamVjdHMgYXJlIGVxdWFsIGJ5IHZhbHVlLiBJdCBkb2VzIGRlZXAgY2hlY2tpbmcgZm9yXG4gKiB2YWx1ZXMgd2l0aGluIGFycmF5cyBvciBwbGFpbiBvYmplY3RzLiBFcXVhbGl0eSBmb3IgYW55dGhpbmcgdGhhdCBpc1xuICogbm90IGEgRGF0ZSwgQXJyYXksIG9yIGEgcGxhaW4gb2JqZWN0IHdpbGwgYmUgY2hlY2tlZCBhcyBgYSA9PT0gYmAuXG4gKlxuICogQHBhcmFtIHthbnl9IG9iajEgT2JqZWN0XG4gKiBAcGFyYW0ge2FueX0gb2JqMiBPYmplY3RcbiAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgb2JqZWN0cyBhcmUgZGVlcGx5IGVxdWFsLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZXhwb3J0IGNvbnN0IGlzT2JqZWN0RXF1YWwgPSAob2JqMTogYW55LCBvYmoyOiBhbnkpOiBib29sZWFuID0+IHtcbiAgY29uc3QgaXNEYXRlMSA9IGlzRGF0ZShvYmoxKTtcbiAgY29uc3QgaXNEYXRlMiA9IGlzRGF0ZShvYmoyKTtcblxuICBpZiAoKGlzRGF0ZTEgJiYgIWlzRGF0ZTIpIHx8ICghaXNEYXRlMSAmJiBpc0RhdGUyKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChpc0RhdGUxICYmIGlzRGF0ZTIpIHtcbiAgICByZXR1cm4gb2JqMS5nZXRUaW1lKCkgPT09IG9iajIuZ2V0VGltZSgpO1xuICB9XG5cbiAgY29uc3QgaXNBcnJheTEgPSBpc0FycmF5KG9iajEpO1xuICBjb25zdCBpc0FycmF5MiA9IGlzQXJyYXkob2JqMik7XG5cbiAgaWYgKChpc0FycmF5MSAmJiAhaXNBcnJheTIpIHx8ICghaXNBcnJheTEgJiYgaXNBcnJheTIpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGlzQXJyYXkxICYmIGlzQXJyYXkyKSB7XG4gICAgaWYgKG9iajEubGVuZ3RoICE9PSBvYmoyLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBvYmoxLmV2ZXJ5KCh2YWx1ZTogYW55LCBpbmRleDogbnVtYmVyKSA9PiB7XG4gICAgICByZXR1cm4gaXNPYmplY3RFcXVhbCh2YWx1ZSwgb2JqMltpbmRleF0pO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgaXNPYmplY3QxID0gaXNQbGFpbk9iamVjdChvYmoxKTtcbiAgY29uc3QgaXNPYmplY3QyID0gaXNQbGFpbk9iamVjdChvYmoyKTtcblxuICBpZiAoKGlzT2JqZWN0MSAmJiAhaXNPYmplY3QyKSB8fCAoIWlzT2JqZWN0MSAmJiBpc09iamVjdDIpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGlzT2JqZWN0MSAmJiBpc09iamVjdDIpIHtcbiAgICBjb25zdCBrZXlzMSA9IE9iamVjdC5rZXlzKG9iajEpO1xuICAgIGNvbnN0IGtleXMyID0gT2JqZWN0LmtleXMob2JqMik7XG5cbiAgICBpZiAoIWlzT2JqZWN0RXF1YWwoa2V5czEsIGtleXMyKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBrZXlzMS5ldmVyeSgoa2V5KSA9PiB7XG4gICAgICByZXR1cm4gaXNPYmplY3RFcXVhbChvYmoxW2tleV0sIG9iajJba2V5XSk7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gb2JqMSA9PT0gb2JqMjtcbn07XG5cbi8qKlxuICogQ29waWVzIGRhdGUgb2JqZWN0IGludG8gYSBuZXcgZGF0ZSBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtEYXRlfSBkYXRlIERhdGVcbiAqIEByZXR1cm4ge0RhdGV9IERhdGUgb2JqZWN0IGNvcHlcbiAqL1xuY29uc3QgY29weURhdGUgPSAoZGF0ZTogRGF0ZSk6IERhdGUgPT4ge1xuICByZXR1cm4gbmV3IERhdGUoZGF0ZSk7XG59O1xuXG4vKipcbiAqIERlZXAgY29waWVzIGFuIGFycmF5IGludG8gYSBuZXcgYXJyYXkuIEFycmF5IHZhbHVlcyB3aWxsXG4gKiBiZSBkZWVwIGNvcGllZCB0b28uXG4gKlxuICogQHBhcmFtIHtBcnJheX0gYXJyYXkgQXJyYXlcbiAqIEByZXR1cm4ge0FycmF5fSBEZWVwIGNvcGllZCBhcnJheVxuICovXG5jb25zdCBjb3B5QXJyYXkgPSA8VD4oYXJyYXk6IFRbXSk6IFRbXSA9PiB7XG4gIHJldHVybiBhcnJheS5tYXAoKHZhbHVlKSA9PiBjb3B5T2JqZWN0KHZhbHVlKSk7XG59O1xuXG4vKipcbiAqIERlZXAgY29waWVzIGEgcGxhaW4gb2JqZWN0IGludG8gYSBuZXcgcGxhaW4gb2JqZWN0LiBPYmplY3RcbiAqIHZhbHVlcyB3aWxsIGJlIGRlZXAgY29waWVkIHRvby5cbiAqXG4gKiBAcGFyYW0ge1JlY29yZH0gb2JqIE9iamVjdFxuICogQHJldHVybiB7UmVjb3JkfSBEZWVwIGNvcGllZCBvYmplY3RcbiAqL1xuY29uc3QgY29weVBsYWluT2JqZWN0ID0gPFQ+KG9iajogUmVjb3JkPHN0cmluZywgVD4pOiBSZWNvcmQ8c3RyaW5nLCBUPiA9PiB7XG4gIGNvbnN0IG5ld09iamVjdDogUmVjb3JkPHN0cmluZywgVD4gPSB7fTtcbiAgT2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICBuZXdPYmplY3Rba2V5XSA9IGNvcHlPYmplY3Qob2JqW2tleV0pO1xuICB9KTtcbiAgcmV0dXJuIG5ld09iamVjdDtcbn07XG4iLCIvKipcbiAqIE1ha2VzIGFsbCBkZWVwIHByb3BlcnRpZXMgcGFydGlhbC4gU2FtZSBhcyBQYXJ0aWFsPFQ+IGJ1dCBkZWVwLlxuICovXG5leHBvcnQgdHlwZSBEZWVwUGFydGlhbDxUPiA9IFQgZXh0ZW5kcyBvYmplY3QgPyB7IFtQIGluIGtleW9mIFRdPzogRGVlcFBhcnRpYWw8VFtQXT4gfSA6IFQ7XG5cbi8qKlxuICogTWFrZXMgYWxsIGRlZXAgcHJvcGVydGllcyByZXF1aXJlZC4gU2FtZSBhcyBSZXF1aXJlZDxUPiBidXQgZGVlcC5cbiAqL1xuZXhwb3J0IHR5cGUgRGVlcFJlcXVpcmVkPFQ+ID0gVCBleHRlbmRzIG9iamVjdCA/IHsgW1AgaW4ga2V5b2YgVF0tPzogRGVlcFJlcXVpcmVkPFRbUF0+IH0gOiBUO1xuXG4vKipcbiAqIFR5cGUgY2hlY2sgZm9yIHN0cmluZyB2YWx1ZXMuXG4gKlxuICogQHBhcmFtIHthbnl9IHZhbHVlIEFueSB2YWx1ZVxuICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiBpdCBpcyBhIHN0cmluZywgZmFsc2Ugb3RoZXJ3aXNlXG4gKi9cbmV4cG9ydCBjb25zdCBpc1N0cmluZyA9ICh2YWx1ZTogYW55KTogdmFsdWUgaXMgc3RyaW5nID0+IHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZyc7XG59O1xuXG4vKipcbiAqIFR5cGUgY2hlY2sgZm9yIG51bWJlciB2YWx1ZXMuXG4gKlxuICogQHBhcmFtIHthbnl9IHZhbHVlIEFueSB2YWx1ZVxuICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiBpdCBpcyBhIG51bWJlciwgZmFsc2Ugb3RoZXJ3aXNlXG4gKi9cbmV4cG9ydCBjb25zdCBpc051bWJlciA9ICh2YWx1ZTogYW55KTogdmFsdWUgaXMgbnVtYmVyID0+IHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcic7XG59O1xuXG4vKipcbiAqIFR5cGUgY2hlY2sgZm9yIGJvb2xlYW4gdmFsdWVzLlxuICpcbiAqIEBwYXJhbSB7YW55fSB2YWx1ZSBBbnkgdmFsdWVcbiAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgaXQgaXMgYSBib29sZWFuLCBmYWxzZSBvdGhlcndpc2VcbiAqL1xuZXhwb3J0IGNvbnN0IGlzQm9vbGVhbiA9ICh2YWx1ZTogYW55KTogdmFsdWUgaXMgYm9vbGVhbiA9PiB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJztcbn07XG5cbi8qKlxuICogVHlwZSBjaGVjayBmb3IgRGF0ZSB2YWx1ZXMuXG4gKlxuICogQHBhcmFtIHthbnl9IHZhbHVlIEFueSB2YWx1ZVxuICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiBpdCBpcyBhIERhdGUsIGZhbHNlIG90aGVyd2lzZVxuICovXG5leHBvcnQgY29uc3QgaXNEYXRlID0gKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBEYXRlID0+IHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgRGF0ZTtcbn07XG5cbi8qKlxuICogVHlwZSBjaGVjayBmb3IgQXJyYXkgdmFsdWVzLiBBbGlhcyBmb3IgYEFycmF5LmlzQXJyYXlgLlxuICpcbiAqIEBwYXJhbSB7YW55fSB2YWx1ZSBBbnkgdmFsdWVcbiAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgaXQgaXMgYW4gQXJyYXksIGZhbHNlIG90aGVyd2lzZVxuICovXG5leHBvcnQgY29uc3QgaXNBcnJheSA9ICh2YWx1ZTogYW55KTogdmFsdWUgaXMgQXJyYXk8YW55PiA9PiB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KHZhbHVlKTtcbn07XG5cbi8qKlxuICogVHlwZSBjaGVjayBmb3IgcGxhaW4gb2JqZWN0IHZhbHVlczogeyBba2V5XTogdmFsdWUgfVxuICpcbiAqIEBwYXJhbSB7YW55fSB2YWx1ZSBBbnkgdmFsdWVcbiAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgaXQgaXMgYSBwbGFpbiBvYmplY3QsIGZhbHNlIG90aGVyd2lzZVxuICovXG5leHBvcnQgY29uc3QgaXNQbGFpbk9iamVjdCA9ICh2YWx1ZTogYW55KTogdmFsdWUgaXMgUmVjb3JkPHN0cmluZywgYW55PiA9PiB7XG4gIHJldHVybiB2YWx1ZSAhPT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlLmNvbnN0cnVjdG9yLm5hbWUgPT09ICdPYmplY3QnO1xufTtcblxuLyoqXG4gKiBUeXBlIGNoZWNrIGZvciBudWxsIHZhbHVlcy5cbiAqXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgQW55IHZhbHVlXG4gKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIGl0IGlzIGEgbnVsbCwgZmFsc2Ugb3RoZXJ3aXNlXG4gKi9cbmV4cG9ydCBjb25zdCBpc051bGwgPSAodmFsdWU6IGFueSk6IHZhbHVlIGlzIG51bGwgPT4ge1xuICByZXR1cm4gdmFsdWUgPT09IG51bGw7XG59O1xuXG4vKipcbiAqIFR5cGUgY2hlY2sgZm9yIEZ1bmN0aW9uIHZhbHVlcy5cbiAqXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgQW55IHZhbHVlXG4gKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIGl0IGlzIGEgRnVuY3Rpb24sIGZhbHNlIG90aGVyd2lzZVxuICovXG5leHBvcnQgY29uc3QgaXNGdW5jdGlvbiA9ICh2YWx1ZTogYW55KTogdmFsdWUgaXMgRnVuY3Rpb24gPT4ge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nO1xufTtcbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4vLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuX193ZWJwYWNrX3JlcXVpcmVfXy5tID0gX193ZWJwYWNrX21vZHVsZXNfXztcblxuLy8gdGhlIHN0YXJ0dXAgZnVuY3Rpb25cbl9fd2VicGFja19yZXF1aXJlX18ueCA9ICgpID0+IHtcblx0Ly8gTG9hZCBlbnRyeSBtb2R1bGUgYW5kIHJldHVybiBleHBvcnRzXG5cdC8vIFRoaXMgZW50cnkgbW9kdWxlIGRlcGVuZHMgb24gb3RoZXIgbG9hZGVkIGNodW5rcyBhbmQgZXhlY3V0aW9uIG5lZWQgdG8gYmUgZGVsYXllZFxuXHR2YXIgX193ZWJwYWNrX2V4cG9ydHNfXyA9IF9fd2VicGFja19yZXF1aXJlX18uTyh1bmRlZmluZWQsIFtcInZlbmRvcnMtbm9kZV9tb2R1bGVzX2QzLWZvcmNlX3NyY19jZW50ZXJfanMtbm9kZV9tb2R1bGVzX2QzLWZvcmNlX3NyY19jb2xsaWRlX2pzLW5vZGVfbW9kdWxlcy0wNDMyN2RcIl0sICgpID0+IChfX3dlYnBhY2tfcmVxdWlyZV9fKFwiLi9zcmMvc2ltdWxhdG9yL3R5cGVzL3dlYi13b3JrZXItc2ltdWxhdG9yL3Byb2Nlc3Mud29ya2VyLnRzXCIpKSlcblx0X193ZWJwYWNrX2V4cG9ydHNfXyA9IF9fd2VicGFja19yZXF1aXJlX18uTyhfX3dlYnBhY2tfZXhwb3J0c19fKTtcblx0cmV0dXJuIF9fd2VicGFja19leHBvcnRzX187XG59O1xuXG4iLCJ2YXIgZGVmZXJyZWQgPSBbXTtcbl9fd2VicGFja19yZXF1aXJlX18uTyA9IChyZXN1bHQsIGNodW5rSWRzLCBmbiwgcHJpb3JpdHkpID0+IHtcblx0aWYoY2h1bmtJZHMpIHtcblx0XHRwcmlvcml0eSA9IHByaW9yaXR5IHx8IDA7XG5cdFx0Zm9yKHZhciBpID0gZGVmZXJyZWQubGVuZ3RoOyBpID4gMCAmJiBkZWZlcnJlZFtpIC0gMV1bMl0gPiBwcmlvcml0eTsgaS0tKSBkZWZlcnJlZFtpXSA9IGRlZmVycmVkW2kgLSAxXTtcblx0XHRkZWZlcnJlZFtpXSA9IFtjaHVua0lkcywgZm4sIHByaW9yaXR5XTtcblx0XHRyZXR1cm47XG5cdH1cblx0dmFyIG5vdEZ1bGZpbGxlZCA9IEluZmluaXR5O1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IGRlZmVycmVkLmxlbmd0aDsgaSsrKSB7XG5cdFx0dmFyIFtjaHVua0lkcywgZm4sIHByaW9yaXR5XSA9IGRlZmVycmVkW2ldO1xuXHRcdHZhciBmdWxmaWxsZWQgPSB0cnVlO1xuXHRcdGZvciAodmFyIGogPSAwOyBqIDwgY2h1bmtJZHMubGVuZ3RoOyBqKyspIHtcblx0XHRcdGlmICgocHJpb3JpdHkgJiAxID09PSAwIHx8IG5vdEZ1bGZpbGxlZCA+PSBwcmlvcml0eSkgJiYgT2JqZWN0LmtleXMoX193ZWJwYWNrX3JlcXVpcmVfXy5PKS5ldmVyeSgoa2V5KSA9PiAoX193ZWJwYWNrX3JlcXVpcmVfXy5PW2tleV0oY2h1bmtJZHNbal0pKSkpIHtcblx0XHRcdFx0Y2h1bmtJZHMuc3BsaWNlKGotLSwgMSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRmdWxmaWxsZWQgPSBmYWxzZTtcblx0XHRcdFx0aWYocHJpb3JpdHkgPCBub3RGdWxmaWxsZWQpIG5vdEZ1bGZpbGxlZCA9IHByaW9yaXR5O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZihmdWxmaWxsZWQpIHtcblx0XHRcdGRlZmVycmVkLnNwbGljZShpLS0sIDEpXG5cdFx0XHR2YXIgciA9IGZuKCk7XG5cdFx0XHRpZiAociAhPT0gdW5kZWZpbmVkKSByZXN1bHQgPSByO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufTsiLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLmYgPSB7fTtcbi8vIFRoaXMgZmlsZSBjb250YWlucyBvbmx5IHRoZSBlbnRyeSBjaHVuay5cbi8vIFRoZSBjaHVuayBsb2FkaW5nIGZ1bmN0aW9uIGZvciBhZGRpdGlvbmFsIGNodW5rc1xuX193ZWJwYWNrX3JlcXVpcmVfXy5lID0gKGNodW5rSWQpID0+IHtcblx0cmV0dXJuIFByb21pc2UuYWxsKE9iamVjdC5rZXlzKF9fd2VicGFja19yZXF1aXJlX18uZikucmVkdWNlKChwcm9taXNlcywga2V5KSA9PiB7XG5cdFx0X193ZWJwYWNrX3JlcXVpcmVfXy5mW2tleV0oY2h1bmtJZCwgcHJvbWlzZXMpO1xuXHRcdHJldHVybiBwcm9taXNlcztcblx0fSwgW10pKTtcbn07IiwiLy8gVGhpcyBmdW5jdGlvbiBhbGxvdyB0byByZWZlcmVuY2UgYXN5bmMgY2h1bmtzIGFuZCBzaWJsaW5nIGNodW5rcyBmb3IgdGhlIGVudHJ5cG9pbnRcbl9fd2VicGFja19yZXF1aXJlX18udSA9IChjaHVua0lkKSA9PiB7XG5cdC8vIHJldHVybiB1cmwgZm9yIGZpbGVuYW1lcyBub3QgYmFzZWQgb24gdGVtcGxhdGVcblx0aWYgKGNodW5rSWQgPT09IFwidmVuZG9ycy1ub2RlX21vZHVsZXNfZDMtZm9yY2Vfc3JjX2NlbnRlcl9qcy1ub2RlX21vZHVsZXNfZDMtZm9yY2Vfc3JjX2NvbGxpZGVfanMtbm9kZV9tb2R1bGVzLTA0MzI3ZFwiKSByZXR1cm4gXCJvcmIud29ya2VyLnZlbmRvci5qc1wiO1xuXHQvLyByZXR1cm4gdXJsIGZvciBmaWxlbmFtZXMgYmFzZWQgb24gdGVtcGxhdGVcblx0cmV0dXJuIHVuZGVmaW5lZDtcbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5nID0gKGZ1bmN0aW9uKCkge1xuXHRpZiAodHlwZW9mIGdsb2JhbFRoaXMgPT09ICdvYmplY3QnKSByZXR1cm4gZ2xvYmFsVGhpcztcblx0dHJ5IHtcblx0XHRyZXR1cm4gdGhpcyB8fCBuZXcgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdGlmICh0eXBlb2Ygd2luZG93ID09PSAnb2JqZWN0JykgcmV0dXJuIHdpbmRvdztcblx0fVxufSkoKTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwidmFyIHNjcmlwdFVybDtcbmlmIChfX3dlYnBhY2tfcmVxdWlyZV9fLmcuaW1wb3J0U2NyaXB0cykgc2NyaXB0VXJsID0gX193ZWJwYWNrX3JlcXVpcmVfXy5nLmxvY2F0aW9uICsgXCJcIjtcbnZhciBkb2N1bWVudCA9IF9fd2VicGFja19yZXF1aXJlX18uZy5kb2N1bWVudDtcbmlmICghc2NyaXB0VXJsICYmIGRvY3VtZW50KSB7XG5cdGlmIChkb2N1bWVudC5jdXJyZW50U2NyaXB0KVxuXHRcdHNjcmlwdFVybCA9IGRvY3VtZW50LmN1cnJlbnRTY3JpcHQuc3JjO1xuXHRpZiAoIXNjcmlwdFVybCkge1xuXHRcdHZhciBzY3JpcHRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJzY3JpcHRcIik7XG5cdFx0aWYoc2NyaXB0cy5sZW5ndGgpIHNjcmlwdFVybCA9IHNjcmlwdHNbc2NyaXB0cy5sZW5ndGggLSAxXS5zcmNcblx0fVxufVxuLy8gV2hlbiBzdXBwb3J0aW5nIGJyb3dzZXJzIHdoZXJlIGFuIGF1dG9tYXRpYyBwdWJsaWNQYXRoIGlzIG5vdCBzdXBwb3J0ZWQgeW91IG11c3Qgc3BlY2lmeSBhbiBvdXRwdXQucHVibGljUGF0aCBtYW51YWxseSB2aWEgY29uZmlndXJhdGlvblxuLy8gb3IgcGFzcyBhbiBlbXB0eSBzdHJpbmcgKFwiXCIpIGFuZCBzZXQgdGhlIF9fd2VicGFja19wdWJsaWNfcGF0aF9fIHZhcmlhYmxlIGZyb20geW91ciBjb2RlIHRvIHVzZSB5b3VyIG93biBsb2dpYy5cbmlmICghc2NyaXB0VXJsKSB0aHJvdyBuZXcgRXJyb3IoXCJBdXRvbWF0aWMgcHVibGljUGF0aCBpcyBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlclwiKTtcbnNjcmlwdFVybCA9IHNjcmlwdFVybC5yZXBsYWNlKC8jLiokLywgXCJcIikucmVwbGFjZSgvXFw/LiokLywgXCJcIikucmVwbGFjZSgvXFwvW15cXC9dKyQvLCBcIi9cIik7XG5fX3dlYnBhY2tfcmVxdWlyZV9fLnAgPSBzY3JpcHRVcmw7IiwiLy8gbm8gYmFzZVVSSVxuXG4vLyBvYmplY3QgdG8gc3RvcmUgbG9hZGVkIGNodW5rc1xuLy8gXCIxXCIgbWVhbnMgXCJhbHJlYWR5IGxvYWRlZFwiXG52YXIgaW5zdGFsbGVkQ2h1bmtzID0ge1xuXHRcInByb2Nlc3Mud29ya2VyXCI6IDFcbn07XG5cbi8vIGltcG9ydFNjcmlwdHMgY2h1bmsgbG9hZGluZ1xudmFyIGluc3RhbGxDaHVuayA9IChkYXRhKSA9PiB7XG5cdHZhciBbY2h1bmtJZHMsIG1vcmVNb2R1bGVzLCBydW50aW1lXSA9IGRhdGE7XG5cdGZvcih2YXIgbW9kdWxlSWQgaW4gbW9yZU1vZHVsZXMpIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8obW9yZU1vZHVsZXMsIG1vZHVsZUlkKSkge1xuXHRcdFx0X193ZWJwYWNrX3JlcXVpcmVfXy5tW21vZHVsZUlkXSA9IG1vcmVNb2R1bGVzW21vZHVsZUlkXTtcblx0XHR9XG5cdH1cblx0aWYocnVudGltZSkgcnVudGltZShfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblx0d2hpbGUoY2h1bmtJZHMubGVuZ3RoKVxuXHRcdGluc3RhbGxlZENodW5rc1tjaHVua0lkcy5wb3AoKV0gPSAxO1xuXHRwYXJlbnRDaHVua0xvYWRpbmdGdW5jdGlvbihkYXRhKTtcbn07XG5fX3dlYnBhY2tfcmVxdWlyZV9fLmYuaSA9IChjaHVua0lkLCBwcm9taXNlcykgPT4ge1xuXHQvLyBcIjFcIiBpcyB0aGUgc2lnbmFsIGZvciBcImFscmVhZHkgbG9hZGVkXCJcblx0aWYoIWluc3RhbGxlZENodW5rc1tjaHVua0lkXSkge1xuXHRcdGlmKHRydWUpIHsgLy8gYWxsIGNodW5rcyBoYXZlIEpTXG5cdFx0XHRpbXBvcnRTY3JpcHRzKF9fd2VicGFja19yZXF1aXJlX18ucCArIF9fd2VicGFja19yZXF1aXJlX18udShjaHVua0lkKSk7XG5cdFx0fVxuXHR9XG59O1xuXG52YXIgY2h1bmtMb2FkaW5nR2xvYmFsID0gc2VsZltcIndlYnBhY2tDaHVua09yYlwiXSA9IHNlbGZbXCJ3ZWJwYWNrQ2h1bmtPcmJcIl0gfHwgW107XG52YXIgcGFyZW50Q2h1bmtMb2FkaW5nRnVuY3Rpb24gPSBjaHVua0xvYWRpbmdHbG9iYWwucHVzaC5iaW5kKGNodW5rTG9hZGluZ0dsb2JhbCk7XG5jaHVua0xvYWRpbmdHbG9iYWwucHVzaCA9IGluc3RhbGxDaHVuaztcblxuLy8gbm8gSE1SXG5cbi8vIG5vIEhNUiBtYW5pZmVzdCIsInZhciBuZXh0ID0gX193ZWJwYWNrX3JlcXVpcmVfXy54O1xuX193ZWJwYWNrX3JlcXVpcmVfXy54ID0gKCkgPT4ge1xuXHRyZXR1cm4gX193ZWJwYWNrX3JlcXVpcmVfXy5lKFwidmVuZG9ycy1ub2RlX21vZHVsZXNfZDMtZm9yY2Vfc3JjX2NlbnRlcl9qcy1ub2RlX21vZHVsZXNfZDMtZm9yY2Vfc3JjX2NvbGxpZGVfanMtbm9kZV9tb2R1bGVzLTA0MzI3ZFwiKS50aGVuKG5leHQpO1xufTsiLCIiLCIvLyBydW4gc3RhcnR1cFxudmFyIF9fd2VicGFja19leHBvcnRzX18gPSBfX3dlYnBhY2tfcmVxdWlyZV9fLngoKTtcbiIsIiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==