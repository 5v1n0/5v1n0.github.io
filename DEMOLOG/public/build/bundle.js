
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function cubicInOut(t) {
        return t < 0.5 ? 4.0 * t * t * t : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
    }
    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }
    function quintOut(t) {
        return --t * t * t * t * t + 1;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }
    function slide(node, { delay = 0, duration = 400, easing = cubicOut }) {
        const style = getComputedStyle(node);
        const opacity = +style.opacity;
        const height = parseFloat(style.height);
        const padding_top = parseFloat(style.paddingTop);
        const padding_bottom = parseFloat(style.paddingBottom);
        const margin_top = parseFloat(style.marginTop);
        const margin_bottom = parseFloat(style.marginBottom);
        const border_top_width = parseFloat(style.borderTopWidth);
        const border_bottom_width = parseFloat(style.borderBottomWidth);
        return {
            delay,
            duration,
            easing,
            css: t => 'overflow: hidden;' +
                `opacity: ${Math.min(t * 20, 1) * opacity};` +
                `height: ${t * height}px;` +
                `padding-top: ${t * padding_top}px;` +
                `padding-bottom: ${t * padding_bottom}px;` +
                `margin-top: ${t * margin_top}px;` +
                `margin-bottom: ${t * margin_bottom}px;` +
                `border-top-width: ${t * border_top_width}px;` +
                `border-bottom-width: ${t * border_bottom_width}px;`
        };
    }
    function scale(node, { delay = 0, duration = 400, easing = cubicOut, start = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const sd = 1 - start;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (_t, u) => `
			transform: ${transform} scale(${1 - (sd * u)});
			opacity: ${target_opacity - (od * u)}
		`
        };
    }
    function draw(node, { delay = 0, speed, duration, easing = cubicInOut }) {
        const len = node.getTotalLength();
        if (duration === undefined) {
            if (speed === undefined) {
                duration = 800;
            }
            else {
                duration = len / speed;
            }
        }
        else if (typeof duration === 'function') {
            duration = duration(len);
        }
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `stroke-dasharray: ${t * len} ${u * len}`
        };
    }

    function flip(node, animation, params) {
        const style = getComputedStyle(node);
        const transform = style.transform === 'none' ? '' : style.transform;
        const scaleX = animation.from.width / node.clientWidth;
        const scaleY = animation.from.height / node.clientHeight;
        const dx = (animation.from.left - animation.to.left) / scaleX;
        const dy = (animation.from.top - animation.to.top) / scaleY;
        const d = Math.sqrt(dx * dx + dy * dy);
        const { delay = 0, duration = (d) => Math.sqrt(d) * 120, easing = cubicOut } = params;
        return {
            delay,
            duration: is_function(duration) ? duration(d) : duration,
            easing,
            css: (_t, u) => `transform: ${transform} translate(${u * dx}px, ${u * dy}px);`
        };
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function is_date(obj) {
        return Object.prototype.toString.call(obj) === '[object Date]';
    }

    function get_interpolator(a, b) {
        if (a === b || a !== a)
            return () => a;
        const type = typeof a;
        if (type !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
            throw new Error('Cannot interpolate values of different type');
        }
        if (Array.isArray(a)) {
            const arr = b.map((bi, i) => {
                return get_interpolator(a[i], bi);
            });
            return t => arr.map(fn => fn(t));
        }
        if (type === 'object') {
            if (!a || !b)
                throw new Error('Object cannot be null');
            if (is_date(a) && is_date(b)) {
                a = a.getTime();
                b = b.getTime();
                const delta = b - a;
                return t => new Date(a + t * delta);
            }
            const keys = Object.keys(b);
            const interpolators = {};
            keys.forEach(key => {
                interpolators[key] = get_interpolator(a[key], b[key]);
            });
            return t => {
                const result = {};
                keys.forEach(key => {
                    result[key] = interpolators[key](t);
                });
                return result;
            };
        }
        if (type === 'number') {
            const delta = b - a;
            return t => a + t * delta;
        }
        throw new Error(`Cannot interpolate ${type} values`);
    }
    function tweened(value, defaults = {}) {
        const store = writable(value);
        let task;
        let target_value = value;
        function set(new_value, opts) {
            if (value == null) {
                store.set(value = new_value);
                return Promise.resolve();
            }
            target_value = new_value;
            let previous_task = task;
            let started = false;
            let { delay = 0, duration = 400, easing = identity, interpolate = get_interpolator } = assign(assign({}, defaults), opts);
            if (duration === 0) {
                if (previous_task) {
                    previous_task.abort();
                    previous_task = null;
                }
                store.set(value = target_value);
                return Promise.resolve();
            }
            const start = now() + delay;
            let fn;
            task = loop(now => {
                if (now < start)
                    return true;
                if (!started) {
                    fn = interpolate(value, new_value);
                    if (typeof duration === 'function')
                        duration = duration(value, new_value);
                    started = true;
                }
                if (previous_task) {
                    previous_task.abort();
                    previous_task = null;
                }
                const elapsed = now - start;
                if (elapsed > duration) {
                    store.set(value = new_value);
                    return false;
                }
                // @ts-ignore
                store.set(value = fn(easing(elapsed / duration)));
                return true;
            });
            return task.promise;
        }
        return {
            set,
            update: (fn, opts) => set(fn(target_value, value), opts),
            subscribe: store.subscribe
        };
    }

    /* src\App.svelte generated by Svelte v3.31.2 */
    const file = "src\\App.svelte";

    // (65:1) {#if help === true}
    function create_if_block(ctx) {
    	let div6;
    	let div0;
    	let a0;
    	let t1;
    	let t2;
    	let div1;
    	let a1;
    	let t4;
    	let t5;
    	let div2;
    	let a2;
    	let t7;
    	let t8;
    	let div3;
    	let a3;
    	let t10;
    	let t11;
    	let div4;
    	let a4;
    	let t13;
    	let t14;
    	let div5;
    	let a5;
    	let t16;
    	let div6_transition;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*toggleGif*/ ctx[2] === 1 && create_if_block_6(ctx);
    	let if_block1 = /*toggleGif*/ ctx[2] === 2 && create_if_block_5(ctx);
    	let if_block2 = /*toggleGif*/ ctx[2] === 3 && create_if_block_4(ctx);
    	let if_block3 = /*toggleGif*/ ctx[2] === 4 && create_if_block_3(ctx);
    	let if_block4 = /*toggleGif*/ ctx[2] === 5 && create_if_block_2(ctx);
    	let if_block5 = /*toggleGif*/ ctx[2] === 6 && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			a0.textContent = "Beastiary";
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			div1 = element("div");
    			a1 = element("a");
    			a1.textContent = "Vent";
    			t4 = space();
    			if (if_block1) if_block1.c();
    			t5 = space();
    			div2 = element("div");
    			a2 = element("a");
    			a2.textContent = "Records";
    			t7 = space();
    			if (if_block2) if_block2.c();
    			t8 = space();
    			div3 = element("div");
    			a3 = element("a");
    			a3.textContent = "Progression";
    			t10 = space();
    			if (if_block3) if_block3.c();
    			t11 = space();
    			div4 = element("div");
    			a4 = element("a");
    			a4.textContent = "Composition";
    			t13 = space();
    			if (if_block4) if_block4.c();
    			t14 = space();
    			div5 = element("div");
    			a5 = element("a");
    			a5.textContent = "Friends";
    			t16 = space();
    			if (if_block5) if_block5.c();
    			attr_dev(a0, "href", "#s");
    			add_location(a0, file, 67, 3, 1820);
    			attr_dev(div0, "id", "help-1");
    			attr_dev(div0, "class", "helpBoundary");
    			add_location(div0, file, 66, 2, 1778);
    			attr_dev(a1, "href", "#s");
    			add_location(a1, file, 78, 3, 2265);
    			attr_dev(div1, "id", "help-2");
    			attr_dev(div1, "class", "helpBoundary");
    			add_location(div1, file, 77, 2, 2223);
    			attr_dev(a2, "href", "#s");
    			add_location(a2, file, 88, 3, 2692);
    			attr_dev(div2, "id", "help-3");
    			attr_dev(div2, "class", "helpBoundary");
    			add_location(div2, file, 87, 2, 2650);
    			attr_dev(a3, "href", "#s");
    			add_location(a3, file, 98, 3, 3066);
    			attr_dev(div3, "id", "help-4");
    			attr_dev(div3, "class", "helpBoundary");
    			add_location(div3, file, 97, 2, 3024);
    			attr_dev(a4, "href", "#s");
    			add_location(a4, file, 108, 3, 3455);
    			attr_dev(div4, "id", "help-5");
    			attr_dev(div4, "class", "helpBoundary");
    			add_location(div4, file, 107, 2, 3413);
    			attr_dev(a5, "href", "#s");
    			add_location(a5, file, 117, 3, 3733);
    			attr_dev(div5, "id", "help-6");
    			attr_dev(div5, "class", "helpBoundary");
    			add_location(div5, file, 116, 2, 3691);
    			attr_dev(div6, "id", "help-box");
    			add_location(div6, file, 65, 1, 1718);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div0);
    			append_dev(div0, a0);
    			append_dev(div0, t1);
    			if (if_block0) if_block0.m(div0, null);
    			append_dev(div6, t2);
    			append_dev(div6, div1);
    			append_dev(div1, a1);
    			append_dev(div1, t4);
    			if (if_block1) if_block1.m(div1, null);
    			append_dev(div6, t5);
    			append_dev(div6, div2);
    			append_dev(div2, a2);
    			append_dev(div2, t7);
    			if (if_block2) if_block2.m(div2, null);
    			append_dev(div6, t8);
    			append_dev(div6, div3);
    			append_dev(div3, a3);
    			append_dev(div3, t10);
    			if (if_block3) if_block3.m(div3, null);
    			append_dev(div6, t11);
    			append_dev(div6, div4);
    			append_dev(div4, a4);
    			append_dev(div4, t13);
    			if (if_block4) if_block4.m(div4, null);
    			append_dev(div6, t14);
    			append_dev(div6, div5);
    			append_dev(div5, a5);
    			append_dev(div5, t16);
    			if (if_block5) if_block5.m(div5, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(a0, "click", /*click_handler_1*/ ctx[6], false, false, false),
    					listen_dev(a1, "click", /*click_handler_2*/ ctx[7], false, false, false),
    					listen_dev(a2, "click", /*click_handler_3*/ ctx[8], false, false, false),
    					listen_dev(a3, "click", /*click_handler_4*/ ctx[9], false, false, false),
    					listen_dev(a4, "click", /*click_handler_5*/ ctx[10], false, false, false),
    					listen_dev(a5, "click", /*click_handler_6*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*toggleGif*/ ctx[2] === 1) {
    				if (if_block0) {
    					if (dirty & /*toggleGif*/ 4) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_6(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div0, null);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*toggleGif*/ ctx[2] === 2) {
    				if (if_block1) {
    					if (dirty & /*toggleGif*/ 4) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_5(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div1, null);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*toggleGif*/ ctx[2] === 3) {
    				if (if_block2) {
    					if (dirty & /*toggleGif*/ 4) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_4(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div2, null);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if (/*toggleGif*/ ctx[2] === 4) {
    				if (if_block3) {
    					if (dirty & /*toggleGif*/ 4) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block_3(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(div3, null);
    				}
    			} else if (if_block3) {
    				group_outros();

    				transition_out(if_block3, 1, 1, () => {
    					if_block3 = null;
    				});

    				check_outros();
    			}

    			if (/*toggleGif*/ ctx[2] === 5) {
    				if (if_block4) {
    					if (dirty & /*toggleGif*/ 4) {
    						transition_in(if_block4, 1);
    					}
    				} else {
    					if_block4 = create_if_block_2(ctx);
    					if_block4.c();
    					transition_in(if_block4, 1);
    					if_block4.m(div4, null);
    				}
    			} else if (if_block4) {
    				group_outros();

    				transition_out(if_block4, 1, 1, () => {
    					if_block4 = null;
    				});

    				check_outros();
    			}

    			if (/*toggleGif*/ ctx[2] === 6) {
    				if (if_block5) {
    					if (dirty & /*toggleGif*/ 4) {
    						transition_in(if_block5, 1);
    					}
    				} else {
    					if_block5 = create_if_block_1(ctx);
    					if_block5.c();
    					transition_in(if_block5, 1);
    					if_block5.m(div5, null);
    				}
    			} else if (if_block5) {
    				group_outros();

    				transition_out(if_block5, 1, 1, () => {
    					if_block5 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block3);
    			transition_in(if_block4);
    			transition_in(if_block5);

    			add_render_callback(() => {
    				if (!div6_transition) div6_transition = create_bidirectional_transition(div6, slide, { duration: 300 }, true);
    				div6_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			transition_out(if_block3);
    			transition_out(if_block4);
    			transition_out(if_block5);
    			if (!div6_transition) div6_transition = create_bidirectional_transition(div6, slide, { duration: 300 }, false);
    			div6_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    			if (detaching && div6_transition) div6_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(65:1) {#if help === true}",
    		ctx
    	});

    	return block;
    }

    // (69:3) {#if toggleGif === 1}
    function create_if_block_6(ctx) {
    	let p0;
    	let t0;
    	let br;
    	let t1;
    	let p1;
    	let t3;
    	let p2;
    	let t5;
    	let div;
    	let img;
    	let img_src_value;
    	let div_transition;
    	let current;

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			t0 = text("Immersion: Envisioning mental illnesses as Demons, complete with lore.");
    			br = element("br");
    			t1 = space();
    			p1 = element("p");
    			p1.textContent = "Choose the demon you want to vanquish.";
    			t3 = space();
    			p2 = element("p");
    			p2.textContent = "Unlock new demons.";
    			t5 = space();
    			div = element("div");
    			img = element("img");
    			add_location(br, file, 69, 76, 1984);
    			add_location(p0, file, 69, 3, 1911);
    			add_location(p1, file, 70, 3, 1996);
    			add_location(p2, file, 71, 3, 2045);
    			attr_dev(img, "id", "tut1");
    			if (img.src !== (img_src_value = "./img/Beastiary.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "tut1");
    			add_location(img, file, 73, 3, 2139);
    			attr_dev(div, "class", "gifHolder");
    			add_location(div, file, 72, 3, 2074);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			append_dev(p0, t0);
    			append_dev(p0, br);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, p2, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(p2);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(69:3) {#if toggleGif === 1}",
    		ctx
    	});

    	return block;
    }

    // (80:3) {#if toggleGif === 2}
    function create_if_block_5(ctx) {
    	let p0;
    	let t0;
    	let br;
    	let t1;
    	let p1;
    	let t3;
    	let div;
    	let img;
    	let img_src_value;
    	let div_transition;
    	let current;

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			t0 = text("Gameplay: Choose 3 of 9 available emotions to begin emotion logging.");
    			br = element("br");
    			t1 = space();
    			p1 = element("p");
    			p1.textContent = "Vanquish your inner demon by attacking with emotions you feel strongly about.";
    			t3 = space();
    			div = element("div");
    			img = element("img");
    			add_location(br, file, 80, 74, 2422);
    			add_location(p0, file, 80, 3, 2351);
    			add_location(p1, file, 81, 3, 2434);
    			attr_dev(img, "id", "tut2");
    			if (img.src !== (img_src_value = "./img/Vent.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "tut2");
    			add_location(img, file, 83, 4, 2570);
    			add_location(div, file, 82, 3, 2522);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			append_dev(p0, t0);
    			append_dev(p0, br);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(80:3) {#if toggleGif === 2}",
    		ctx
    	});

    	return block;
    }

    // (90:3) {#if toggleGif === 3}
    function create_if_block_4(ctx) {
    	let p0;
    	let t0;
    	let br;
    	let t1;
    	let p1;
    	let t3;
    	let div;
    	let img;
    	let img_src_value;
    	let div_transition;
    	let current;

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			t0 = text("Review your emotion logs to reflect.");
    			br = element("br");
    			t1 = space();
    			p1 = element("p");
    			p1.textContent = "You may add short personal notes for more details.";
    			t3 = space();
    			div = element("div");
    			img = element("img");
    			add_location(br, file, 90, 42, 2820);
    			add_location(p0, file, 90, 3, 2781);
    			add_location(p1, file, 91, 3, 2832);
    			attr_dev(img, "id", "tut3");
    			if (img.src !== (img_src_value = "./img/Records.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "tut3");
    			add_location(img, file, 93, 4, 2941);
    			add_location(div, file, 92, 3, 2893);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			append_dev(p0, t0);
    			append_dev(p0, br);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(90:3) {#if toggleGif === 3}",
    		ctx
    	});

    	return block;
    }

    // (100:3) {#if toggleGif === 4}
    function create_if_block_3(ctx) {
    	let p0;
    	let t0;
    	let br;
    	let t1;
    	let p1;
    	let t3;
    	let div;
    	let img;
    	let img_src_value;
    	let div_transition;
    	let current;

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			t0 = text("Inventory tracks loots collected from Venting.");
    			br = element("br");
    			t1 = space();
    			p1 = element("p");
    			p1.textContent = "Use acquired items to unlock new demon targets.";
    			t3 = space();
    			div = element("div");
    			img = element("img");
    			add_location(br, file, 100, 52, 3208);
    			add_location(p0, file, 100, 3, 3159);
    			add_location(p1, file, 101, 3, 3220);
    			attr_dev(img, "id", "tut4");
    			if (img.src !== (img_src_value = "./img/Progression.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "tut4");
    			add_location(img, file, 103, 4, 3326);
    			add_location(div, file, 102, 3, 3278);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			append_dev(p0, t0);
    			append_dev(p0, br);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(100:3) {#if toggleGif === 4}",
    		ctx
    	});

    	return block;
    }

    // (110:3) {#if toggleGif === 5}
    function create_if_block_2(ctx) {
    	let p;
    	let t1;
    	let div;
    	let img;
    	let img_src_value;
    	let div_transition;
    	let current;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "-WORK IN PROGRESS-";
    			t1 = space();
    			div = element("div");
    			img = element("img");
    			add_location(p, file, 110, 3, 3548);
    			attr_dev(img, "id", "tut5");
    			if (img.src !== (img_src_value = "")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "tut5");
    			add_location(img, file, 112, 4, 3625);
    			add_location(div, file, 111, 3, 3577);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(110:3) {#if toggleGif === 5}",
    		ctx
    	});

    	return block;
    }

    // (119:3) {#if toggleGif === 6}
    function create_if_block_1(ctx) {
    	let p;
    	let t1;
    	let div;
    	let img;
    	let img_src_value;
    	let div_transition;
    	let current;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "-WORK IN PROGRESS-";
    			t1 = space();
    			div = element("div");
    			img = element("img");
    			add_location(p, file, 119, 3, 3822);
    			attr_dev(img, "id", "tut6");
    			if (img.src !== (img_src_value = "")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "tut6");
    			add_location(img, file, 121, 4, 3899);
    			add_location(div, file, 120, 3, 3851);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(119:3) {#if toggleGif === 6}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div5;
    	let div4;
    	let div1;
    	let div0;
    	let p0;
    	let button;
    	let t1;
    	let t2;
    	let p1;
    	let img;
    	let img_src_value;
    	let t3;
    	let br0;
    	let t4;
    	let span0;
    	let t6;
    	let div3;
    	let div2;
    	let span1;
    	let t8;
    	let p2;
    	let t9;
    	let br1;
    	let t10;
    	let br2;
    	let t11;
    	let a0;
    	let t13;
    	let t14;
    	let br3;
    	let t15;
    	let span2;
    	let t17;
    	let p3;
    	let t18;
    	let br4;
    	let t19;
    	let br5;
    	let t20;
    	let br6;
    	let t21;
    	let br7;
    	let t22;
    	let t23;
    	let br8;
    	let t24;
    	let span3;
    	let t26;
    	let p4;
    	let t27;
    	let br9;
    	let t28;
    	let br10;
    	let t29;
    	let t30;
    	let br11;
    	let t31;
    	let span4;
    	let t33;
    	let p5;
    	let t34;
    	let br12;
    	let t35;
    	let t36;
    	let footer;
    	let span5;
    	let t38;
    	let br13;
    	let t39;
    	let p6;
    	let t40;
    	let a1;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*help*/ ctx[1] === true && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div4 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			p0 = element("p");
    			button = element("button");
    			button.textContent = "Features";
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();
    			p1 = element("p");
    			img = element("img");
    			t3 = space();
    			br0 = element("br");
    			t4 = space();
    			span0 = element("span");
    			span0.textContent = "dEmoLog";
    			t6 = space();
    			div3 = element("div");
    			div2 = element("div");
    			span1 = element("span");
    			span1.textContent = "About";
    			t8 = space();
    			p2 = element("p");
    			t9 = text("The Demon Emotion Log abbreviated: dEmoLog, is an prototype app that integrates game elements (gamification) to the traditional Mood Diary concept. ");
    			br1 = element("br");
    			t10 = text("\n\t\t\t\tThe hope is that with Gamification added, users would have increased motivation to log their moods regularly, thus aiding their management of mental health.");
    			br2 = element("br");
    			t11 = text("\n\t\t\t\tCheck out the ");
    			a0 = element("a");
    			a0.textContent = "Features";
    			t13 = text(" for a quick highlight of what the app offers. ** GIFs not indicative of final app look.");
    			t14 = space();
    			br3 = element("br");
    			t15 = space();
    			span2 = element("span");
    			span2.textContent = "Gamification";
    			t17 = space();
    			p3 = element("p");
    			t18 = text("Some Gamification elements integrated in the app include:");
    			br4 = element("br");
    			t19 = text("\n\t\t\t\t\t- Narrative: create an immersive backstory/setting");
    			br5 = element("br");
    			t20 = text("\n\t\t\t\t\t- Aesthetic: an specific aesthetic of artwork for further immersion");
    			br6 = element("br");
    			t21 = text("\n\t\t\t\t\t- Game Mechanics: taking away mundaneness of emotion logging by turning task into a gaming experience");
    			br7 = element("br");
    			t22 = text("\n\t\t\t\t\t- Progression: sustaining user interest through working towards goals in app");
    			t23 = space();
    			br8 = element("br");
    			t24 = space();
    			span3 = element("span");
    			span3.textContent = "Experimental Sonification of Emotions";
    			t26 = space();
    			p4 = element("p");
    			t27 = text("-Sonification of Emotions aka, Composition in the app refers to the feature that converts emotions into music.");
    			br9 = element("br");
    			t28 = text("\n\t\t\t\t\t- The idea is to allow users to 'listen/playback' their emotions so they could possibly gain insights they otherwise would not if they were to read them traditionally. ");
    			br10 = element("br");
    			t29 = text("\n\t\t\t\t\t- Data from each emotion log would be used to generate an emotion piece.");
    			t30 = space();
    			br11 = element("br");
    			t31 = space();
    			span4 = element("span");
    			span4.textContent = "Notes";
    			t33 = space();
    			p5 = element("p");
    			t34 = text("- Work in progress: Composition");
    			br12 = element("br");
    			t35 = text("\n\t\t\t\t\t- Current info is accurate as of 8 Jan 2021");
    			t36 = space();
    			footer = element("footer");
    			span5 = element("span");
    			span5.textContent = "dEmoLog";
    			t38 = space();
    			br13 = element("br");
    			t39 = space();
    			p6 = element("p");
    			t40 = text("created by ");
    			a1 = element("a");
    			a1.textContent = "5v1n0";
    			attr_dev(button, "id", "tutBtn");
    			add_location(button, file, 62, 5, 1620);
    			add_location(p0, file, 62, 2, 1617);
    			attr_dev(div0, "id", "help");
    			add_location(div0, file, 61, 2, 1599);
    			attr_dev(img, "id", "appIcon");
    			if (img.src !== (img_src_value = "./img/appIcon_03.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "appIcon");
    			add_location(img, file, 132, 2, 4027);
    			add_location(br0, file, 133, 2, 4090);
    			attr_dev(span0, "id", "appTitleFont");
    			add_location(span0, file, 134, 2, 4097);
    			attr_dev(p1, "class", "select-container");
    			add_location(p1, file, 128, 2, 3988);
    			attr_dev(div1, "class", "COF-wheel");
    			add_location(div1, file, 60, 2, 1573);
    			attr_dev(span1, "class", "description-header");
    			add_location(span1, file, 141, 4, 4232);
    			add_location(br1, file, 143, 155, 4438);
    			add_location(br2, file, 144, 160, 4603);
    			attr_dev(a0, "id", "pingSource");
    			attr_dev(a0, "href", "#");
    			add_location(a0, file, 145, 18, 4626);
    			add_location(p2, file, 143, 4, 4287);
    			add_location(br3, file, 150, 4, 4862);
    			attr_dev(span2, "class", "description-header");
    			add_location(span2, file, 151, 4, 4871);
    			add_location(br4, file, 152, 65, 4989);
    			add_location(br5, file, 153, 55, 5049);
    			add_location(br6, file, 154, 72, 5126);
    			add_location(br7, file, 155, 106, 5237);
    			add_location(p3, file, 152, 5, 4929);
    			add_location(br8, file, 158, 5, 5339);
    			attr_dev(span3, "class", "description-header");
    			add_location(span3, file, 159, 4, 5348);
    			add_location(br9, file, 160, 118, 5544);
    			add_location(br10, file, 161, 173, 5722);
    			add_location(p4, file, 160, 5, 5431);
    			add_location(br11, file, 164, 4, 5819);
    			add_location(span4, file, 165, 5, 5829);
    			add_location(br12, file, 166, 39, 5887);
    			add_location(p5, file, 166, 5, 5853);
    			attr_dev(div2, "class", "introBox");
    			add_location(div2, file, 140, 3, 4205);
    			attr_dev(div3, "class", "song-detail");
    			add_location(div3, file, 139, 2, 4176);
    			attr_dev(div4, "class", "mini-container");
    			add_location(div4, file, 59, 1, 1542);
    			attr_dev(div5, "class", "container");
    			add_location(div5, file, 58, 0, 1517);
    			attr_dev(span5, "id", "home");
    			add_location(span5, file, 177, 2, 6022);
    			add_location(br13, file, 178, 2, 6085);
    			attr_dev(a1, "href", "https://github.com/5v1n0");
    			attr_dev(a1, "target", "_blank");
    			add_location(a1, file, 179, 16, 6106);
    			add_location(p6, file, 179, 2, 6092);
    			add_location(footer, file, 176, 1, 6011);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div4);
    			append_dev(div4, div1);
    			append_dev(div1, div0);
    			append_dev(div0, p0);
    			append_dev(p0, button);
    			append_dev(div0, t1);
    			if (if_block) if_block.m(div0, null);
    			append_dev(div1, t2);
    			append_dev(div1, p1);
    			append_dev(p1, img);
    			append_dev(p1, t3);
    			append_dev(p1, br0);
    			append_dev(p1, t4);
    			append_dev(p1, span0);
    			append_dev(div4, t6);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, span1);
    			append_dev(div2, t8);
    			append_dev(div2, p2);
    			append_dev(p2, t9);
    			append_dev(p2, br1);
    			append_dev(p2, t10);
    			append_dev(p2, br2);
    			append_dev(p2, t11);
    			append_dev(p2, a0);
    			append_dev(p2, t13);
    			append_dev(div2, t14);
    			append_dev(div2, br3);
    			append_dev(div2, t15);
    			append_dev(div2, span2);
    			append_dev(div2, t17);
    			append_dev(div2, p3);
    			append_dev(p3, t18);
    			append_dev(p3, br4);
    			append_dev(p3, t19);
    			append_dev(p3, br5);
    			append_dev(p3, t20);
    			append_dev(p3, br6);
    			append_dev(p3, t21);
    			append_dev(p3, br7);
    			append_dev(p3, t22);
    			append_dev(div2, t23);
    			append_dev(div2, br8);
    			append_dev(div2, t24);
    			append_dev(div2, span3);
    			append_dev(div2, t26);
    			append_dev(div2, p4);
    			append_dev(p4, t27);
    			append_dev(p4, br9);
    			append_dev(p4, t28);
    			append_dev(p4, br10);
    			append_dev(p4, t29);
    			append_dev(div2, t30);
    			append_dev(div2, br11);
    			append_dev(div2, t31);
    			append_dev(div2, span4);
    			append_dev(div2, t33);
    			append_dev(div2, p5);
    			append_dev(p5, t34);
    			append_dev(p5, br12);
    			append_dev(p5, t35);
    			insert_dev(target, t36, anchor);
    			insert_dev(target, footer, anchor);
    			append_dev(footer, span5);
    			append_dev(footer, t38);
    			append_dev(footer, br13);
    			append_dev(footer, t39);
    			append_dev(footer, p6);
    			append_dev(p6, t40);
    			append_dev(p6, a1);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*click_handler*/ ctx[5], false, false, false),
    					listen_dev(a0, "mouseover", /*mouseover_handler*/ ctx[12], false, false, false),
    					listen_dev(a0, "mouseout", /*mouseout_handler*/ ctx[13], false, false, false),
    					listen_dev(span5, "click", /*click_handler_7*/ ctx[14], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*help*/ ctx[1] === true) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*help*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			if (if_block) if_block.d();
    			if (detaching) detach_dev(t36);
    			if (detaching) detach_dev(footer);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function pingTutorialIn() {
    	document.getElementById("tutBtn").style.background = "#026670";
    	document.getElementById("tutBtn").style.color = "white";
    	document.getElementById("pingSource").style.color = "#026670";
    	document.getElementById("pingSource").style.cursor = "default";
    }

    function pingTutorialOut() {
    	document.getElementById("tutBtn").style.background = "#EDEAE5";
    	document.getElementById("tutBtn").style.color = "rgb(173,170,165)";
    	document.getElementById("pingSource").style.color = "rgb(173,170,165)";
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let visible = false;
    	let showDetail = false;
    	let showSongs = false;
    	let showSwatch = false;
    	let showOverheadChords = false;
    	let showRightInnerLeft = true;
    	let error = false;
    	let intro = true;
    	let help = false;
    	let readyToNodeWheel = false;
    	let loadedCoords = false;

    	function toggleTutorial() {
    		$$invalidate(2, toggleGif = 0);
    		currTut = 0;

    		if (help === false) {
    			$$invalidate(1, help = true);
    		} else {
    			$$invalidate(1, help = false);
    		}
    	}

    	let toggleGif = 0;
    	let currTut = 0;

    	function toggleGifBlinder(target) {
    		if (target === currTut) {
    			$$invalidate(2, toggleGif = 0);
    			currTut = 0;
    		} else {
    			currTut = target;
    			$$invalidate(2, toggleGif = target);
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => toggleTutorial();
    	const click_handler_1 = () => toggleGifBlinder(1);
    	const click_handler_2 = () => toggleGifBlinder(2);
    	const click_handler_3 = () => toggleGifBlinder(3);
    	const click_handler_4 = () => toggleGifBlinder(4);
    	const click_handler_5 = () => toggleGifBlinder(5);
    	const click_handler_6 = () => toggleGifBlinder(6);
    	const mouseover_handler = () => pingTutorialIn();
    	const mouseout_handler = () => pingTutorialOut();

    	const click_handler_7 = () => {
    		$$invalidate(0, intro = true);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		fly,
    		draw,
    		scale,
    		slide,
    		flip,
    		beforeUpdate,
    		afterUpdate,
    		tweened,
    		cubicOut,
    		quintOut,
    		visible,
    		showDetail,
    		showSongs,
    		showSwatch,
    		showOverheadChords,
    		showRightInnerLeft,
    		error,
    		intro,
    		help,
    		readyToNodeWheel,
    		loadedCoords,
    		toggleTutorial,
    		toggleGif,
    		currTut,
    		toggleGifBlinder,
    		pingTutorialIn,
    		pingTutorialOut
    	});

    	$$self.$inject_state = $$props => {
    		if ("visible" in $$props) visible = $$props.visible;
    		if ("showDetail" in $$props) showDetail = $$props.showDetail;
    		if ("showSongs" in $$props) showSongs = $$props.showSongs;
    		if ("showSwatch" in $$props) showSwatch = $$props.showSwatch;
    		if ("showOverheadChords" in $$props) showOverheadChords = $$props.showOverheadChords;
    		if ("showRightInnerLeft" in $$props) showRightInnerLeft = $$props.showRightInnerLeft;
    		if ("error" in $$props) error = $$props.error;
    		if ("intro" in $$props) $$invalidate(0, intro = $$props.intro);
    		if ("help" in $$props) $$invalidate(1, help = $$props.help);
    		if ("readyToNodeWheel" in $$props) readyToNodeWheel = $$props.readyToNodeWheel;
    		if ("loadedCoords" in $$props) loadedCoords = $$props.loadedCoords;
    		if ("toggleGif" in $$props) $$invalidate(2, toggleGif = $$props.toggleGif);
    		if ("currTut" in $$props) currTut = $$props.currTut;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		intro,
    		help,
    		toggleGif,
    		toggleTutorial,
    		toggleGifBlinder,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		mouseover_handler,
    		mouseout_handler,
    		click_handler_7
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
