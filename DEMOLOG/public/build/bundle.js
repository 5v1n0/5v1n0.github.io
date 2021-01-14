
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
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
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
    function empty() {
        return text('');
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
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
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
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
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

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[47] = list[i];
    	child_ctx[49] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[47] = list[i];
    	child_ctx[49] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[47] = list[i];
    	child_ctx[49] = i;
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[47] = list[i];
    	child_ctx[49] = i;
    	return child_ctx;
    }

    function get_each_context_4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[47] = list[i];
    	child_ctx[49] = i;
    	return child_ctx;
    }

    // (186:1) {#if help === true}
    function create_if_block_24(ctx) {
    	let div6;
    	let div0;
    	let a0;
    	let t1;
    	let div1;
    	let a1;
    	let t3;
    	let div2;
    	let a2;
    	let t5;
    	let div3;
    	let a3;
    	let t7;
    	let div4;
    	let a4;
    	let t9;
    	let div5;
    	let a5;
    	let div6_transition;
    	let current;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			a0.textContent = "dEmoLog";
    			t1 = space();
    			div1 = element("div");
    			a1 = element("a");
    			a1.textContent = "Home";
    			t3 = space();
    			div2 = element("div");
    			a2 = element("a");
    			a2.textContent = "Beastiary";
    			t5 = space();
    			div3 = element("div");
    			a3 = element("a");
    			a3.textContent = "Vent";
    			t7 = space();
    			div4 = element("div");
    			a4 = element("a");
    			a4.textContent = "Records";
    			t9 = space();
    			div5 = element("div");
    			a5 = element("a");
    			a5.textContent = "Composition";
    			attr_dev(a0, "href", "#s");
    			add_location(a0, file, 188, 3, 4274);
    			attr_dev(div0, "id", "help-0");
    			attr_dev(div0, "class", "helpBoundary");
    			add_location(div0, file, 187, 2, 4231);
    			attr_dev(a1, "href", "#s");
    			add_location(a1, file, 192, 3, 4386);
    			attr_dev(div1, "id", "help-1");
    			attr_dev(div1, "class", "helpBoundary");
    			add_location(div1, file, 191, 2, 4343);
    			attr_dev(a2, "href", "#s");
    			add_location(a2, file, 196, 3, 4495);
    			attr_dev(div2, "id", "help-2");
    			attr_dev(div2, "class", "helpBoundary");
    			add_location(div2, file, 195, 2, 4452);
    			attr_dev(a3, "href", "#s");
    			add_location(a3, file, 200, 3, 4609);
    			attr_dev(div3, "id", "help-3");
    			attr_dev(div3, "class", "helpBoundary");
    			add_location(div3, file, 199, 2, 4566);
    			attr_dev(a4, "href", "#s");
    			add_location(a4, file, 204, 3, 4718);
    			attr_dev(div4, "id", "help-4");
    			attr_dev(div4, "class", "helpBoundary");
    			add_location(div4, file, 203, 2, 4675);
    			attr_dev(a5, "href", "#s");
    			add_location(a5, file, 208, 3, 4830);
    			attr_dev(div5, "id", "help-5");
    			attr_dev(div5, "class", "helpBoundary");
    			add_location(div5, file, 207, 2, 4787);
    			attr_dev(div6, "id", "help-box");
    			add_location(div6, file, 186, 1, 4170);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div0);
    			append_dev(div0, a0);
    			append_dev(div6, t1);
    			append_dev(div6, div1);
    			append_dev(div1, a1);
    			append_dev(div6, t3);
    			append_dev(div6, div2);
    			append_dev(div2, a2);
    			append_dev(div6, t5);
    			append_dev(div6, div3);
    			append_dev(div3, a3);
    			append_dev(div6, t7);
    			append_dev(div6, div4);
    			append_dev(div4, a4);
    			append_dev(div6, t9);
    			append_dev(div6, div5);
    			append_dev(div5, a5);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(a0, "click", /*click_handler_1*/ ctx[16], false, false, false),
    					listen_dev(a1, "click", /*click_handler_2*/ ctx[17], false, false, false),
    					listen_dev(a2, "click", /*click_handler_3*/ ctx[18], false, false, false),
    					listen_dev(a3, "click", /*click_handler_4*/ ctx[19], false, false, false),
    					listen_dev(a4, "click", /*click_handler_5*/ ctx[20], false, false, false),
    					listen_dev(a5, "click", /*click_handler_6*/ ctx[21], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div6_transition) div6_transition = create_bidirectional_transition(div6, slide, { duration: 300 }, true);
    				div6_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div6_transition) div6_transition = create_bidirectional_transition(div6, slide, { duration: 300 }, false);
    			div6_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			if (detaching && div6_transition) div6_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_24.name,
    		type: "if",
    		source: "(186:1) {#if help === true}",
    		ctx
    	});

    	return block;
    }

    // (220:3) {#key navImg}
    function create_key_block_1(ctx) {
    	let img;
    	let img_src_value;
    	let img_intro;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "id", "appIcon");
    			if (img.src !== (img_src_value = /*navImg*/ ctx[3])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "appIcon");
    			add_location(img, file, 220, 4, 5043);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*navImg*/ 8 && img.src !== (img_src_value = /*navImg*/ ctx[3])) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		i: function intro(local) {
    			if (!img_intro) {
    				add_render_callback(() => {
    					img_intro = create_in_transition(img, fade, { delay: 100, duration: 300 });
    					img_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block_1.name,
    		type: "key",
    		source: "(220:3) {#key navImg}",
    		ctx
    	});

    	return block;
    }

    // (227:8) {#key navLabel}
    function create_key_block(ctx) {
    	let span;
    	let t;
    	let span_intro;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(/*navLabel*/ ctx[4]);
    			attr_dev(span, "id", "appTitleFont");
    			add_location(span, file, 227, 5, 5346);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*navLabel*/ 16) set_data_dev(t, /*navLabel*/ ctx[4]);
    		},
    		i: function intro(local) {
    			if (!span_intro) {
    				add_render_callback(() => {
    					span_intro = create_in_transition(span, fade, { delay: 100, duration: 300 });
    					span_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block.name,
    		type: "key",
    		source: "(227:8) {#key navLabel}",
    		ctx
    	});

    	return block;
    }

    // (244:2) {#if index != 0}
    function create_if_block_18(ctx) {
    	let div2;
    	let div0;
    	let t0;
    	let div1;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let if_block0 = /*index*/ ctx[2] === 1 && create_if_block_23(ctx);
    	let if_block1 = /*index*/ ctx[2] === 2 && create_if_block_22(ctx);
    	let if_block2 = /*index*/ ctx[2] === 3 && create_if_block_21(ctx);
    	let if_block3 = /*index*/ ctx[2] === 4 && create_if_block_20(ctx);
    	let if_block4 = /*index*/ ctx[2] === 5 && create_if_block_19(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			if (if_block2) if_block2.c();
    			t3 = space();
    			if (if_block3) if_block3.c();
    			t4 = space();
    			if (if_block4) if_block4.c();
    			attr_dev(div0, "class", "list-header");
    			add_location(div0, file, 245, 5, 5764);
    			attr_dev(div1, "class", "list-container");
    			add_location(div1, file, 247, 5, 5809);
    			attr_dev(div2, "class", "song-detail-left");
    			add_location(div2, file, 244, 2, 5727);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div1, t1);
    			if (if_block1) if_block1.m(div1, null);
    			append_dev(div1, t2);
    			if (if_block2) if_block2.m(div1, null);
    			append_dev(div1, t3);
    			if (if_block3) if_block3.m(div1, null);
    			append_dev(div1, t4);
    			if (if_block4) if_block4.m(div1, null);
    		},
    		p: function update(ctx, dirty) {
    			if (/*index*/ ctx[2] === 1) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_23(ctx);
    					if_block0.c();
    					if_block0.m(div1, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*index*/ ctx[2] === 2) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_22(ctx);
    					if_block1.c();
    					if_block1.m(div1, t2);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*index*/ ctx[2] === 3) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_21(ctx);
    					if_block2.c();
    					if_block2.m(div1, t3);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*index*/ ctx[2] === 4) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_20(ctx);
    					if_block3.c();
    					if_block3.m(div1, t4);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*index*/ ctx[2] === 5) {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);
    				} else {
    					if_block4 = create_if_block_19(ctx);
    					if_block4.c();
    					if_block4.m(div1, null);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_18.name,
    		type: "if",
    		source: "(244:2) {#if index != 0}",
    		ctx
    	});

    	return block;
    }

    // (249:5) {#if index === 1}
    function create_if_block_23(ctx) {
    	let ul;
    	let each_value_4 = /*HomeArr*/ ctx[6];
    	validate_each_argument(each_value_4);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_4.length; i += 1) {
    		each_blocks[i] = create_each_block_4(get_each_context_4(ctx, each_value_4, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(ul, file, 249, 6, 5869);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*HomeArr, handleSubNav*/ 16448) {
    				each_value_4 = /*HomeArr*/ ctx[6];
    				validate_each_argument(each_value_4);
    				let i;

    				for (i = 0; i < each_value_4.length; i += 1) {
    					const child_ctx = get_each_context_4(ctx, each_value_4, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_4(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_4.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_23.name,
    		type: "if",
    		source: "(249:5) {#if index === 1}",
    		ctx
    	});

    	return block;
    }

    // (251:6) {#each HomeArr as subNav, i}
    function create_each_block_4(ctx) {
    	let li;
    	let a;
    	let t0_value = /*subNav*/ ctx[47] + "";
    	let t0;
    	let a_id_value;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler_9() {
    		return /*click_handler_9*/ ctx[24](/*subNav*/ ctx[47], /*i*/ ctx[49]);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(a, "id", a_id_value = /*subNav*/ ctx[47] + /*i*/ ctx[49]);
    			attr_dev(a, "href", "#");
    			add_location(a, file, 252, 7, 5931);
    			add_location(li, file, 251, 7, 5918);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t0);
    			append_dev(li, t1);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", click_handler_9, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_4.name,
    		type: "each",
    		source: "(251:6) {#each HomeArr as subNav, i}",
    		ctx
    	});

    	return block;
    }

    // (260:5) {#if index === 2}
    function create_if_block_22(ctx) {
    	let ul;
    	let each_value_3 = /*BeastArr*/ ctx[7];
    	validate_each_argument(each_value_3);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(ul, file, 260, 6, 6118);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*BeastArr, handleSubNav*/ 16512) {
    				each_value_3 = /*BeastArr*/ ctx[7];
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_3.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_22.name,
    		type: "if",
    		source: "(260:5) {#if index === 2}",
    		ctx
    	});

    	return block;
    }

    // (262:6) {#each BeastArr as subNav, i}
    function create_each_block_3(ctx) {
    	let li;
    	let a;
    	let t0_value = /*subNav*/ ctx[47] + "";
    	let t0;
    	let a_id_value;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler_10() {
    		return /*click_handler_10*/ ctx[25](/*subNav*/ ctx[47], /*i*/ ctx[49]);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(a, "id", a_id_value = /*subNav*/ ctx[47] + /*i*/ ctx[49]);
    			attr_dev(a, "href", "#");
    			add_location(a, file, 263, 7, 6181);
    			add_location(li, file, 262, 7, 6168);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t0);
    			append_dev(li, t1);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", click_handler_10, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(262:6) {#each BeastArr as subNav, i}",
    		ctx
    	});

    	return block;
    }

    // (271:5) {#if index === 3}
    function create_if_block_21(ctx) {
    	let ul;
    	let each_value_2 = /*VentArr*/ ctx[8];
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(ul, file, 271, 6, 6368);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*VentArr, handleSubNav*/ 16640) {
    				each_value_2 = /*VentArr*/ ctx[8];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_2.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_21.name,
    		type: "if",
    		source: "(271:5) {#if index === 3}",
    		ctx
    	});

    	return block;
    }

    // (273:6) {#each VentArr as subNav, i}
    function create_each_block_2(ctx) {
    	let li;
    	let a;
    	let t0_value = /*subNav*/ ctx[47] + "";
    	let t0;
    	let a_id_value;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler_11() {
    		return /*click_handler_11*/ ctx[26](/*subNav*/ ctx[47], /*i*/ ctx[49]);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(a, "id", a_id_value = /*subNav*/ ctx[47] + /*i*/ ctx[49]);
    			attr_dev(a, "href", "#");
    			add_location(a, file, 274, 7, 6430);
    			add_location(li, file, 273, 7, 6417);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t0);
    			append_dev(li, t1);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", click_handler_11, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(273:6) {#each VentArr as subNav, i}",
    		ctx
    	});

    	return block;
    }

    // (282:5) {#if index === 4}
    function create_if_block_20(ctx) {
    	let ul;
    	let each_value_1 = /*RecordsArr*/ ctx[9];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(ul, file, 282, 6, 6617);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*RecordsArr, handleSubNav*/ 16896) {
    				each_value_1 = /*RecordsArr*/ ctx[9];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_20.name,
    		type: "if",
    		source: "(282:5) {#if index === 4}",
    		ctx
    	});

    	return block;
    }

    // (284:6) {#each RecordsArr as subNav, i}
    function create_each_block_1(ctx) {
    	let li;
    	let a;
    	let t0_value = /*subNav*/ ctx[47] + "";
    	let t0;
    	let a_id_value;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler_12() {
    		return /*click_handler_12*/ ctx[27](/*subNav*/ ctx[47], /*i*/ ctx[49]);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(a, "id", a_id_value = /*subNav*/ ctx[47] + /*i*/ ctx[49]);
    			attr_dev(a, "href", "#");
    			add_location(a, file, 285, 7, 6682);
    			add_location(li, file, 284, 7, 6669);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t0);
    			append_dev(li, t1);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", click_handler_12, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(284:6) {#each RecordsArr as subNav, i}",
    		ctx
    	});

    	return block;
    }

    // (293:5) {#if index === 5}
    function create_if_block_19(ctx) {
    	let ul;
    	let each_value = /*CompArr*/ ctx[10];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(ul, file, 293, 6, 6869);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*CompArr, handleSubNav*/ 17408) {
    				each_value = /*CompArr*/ ctx[10];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_19.name,
    		type: "if",
    		source: "(293:5) {#if index === 5}",
    		ctx
    	});

    	return block;
    }

    // (295:6) {#each CompArr as subNav, i}
    function create_each_block(ctx) {
    	let li;
    	let a;
    	let t0_value = /*subNav*/ ctx[47] + "";
    	let t0;
    	let a_id_value;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler_13() {
    		return /*click_handler_13*/ ctx[28](/*subNav*/ ctx[47], /*i*/ ctx[49]);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(a, "id", a_id_value = /*subNav*/ ctx[47] + /*i*/ ctx[49]);
    			attr_dev(a, "href", "#");
    			add_location(a, file, 296, 7, 6931);
    			add_location(li, file, 295, 7, 6918);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t0);
    			append_dev(li, t1);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", click_handler_13, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(295:6) {#each CompArr as subNav, i}",
    		ctx
    	});

    	return block;
    }

    // (308:3) {#if index === 0}
    function create_if_block_16(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t2;
    	let br0;
    	let t3;
    	let br1;
    	let t4;
    	let br2;
    	let t5;
    	let div1;
    	let div0;
    	let label;
    	let t7;
    	let input;
    	let t8;
    	let hr;
    	let t9;
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*showRightInnerLeft*/ ctx[0] === true && create_if_block_17(ctx);

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "About";
    			t1 = space();
    			p = element("p");
    			t2 = text("The Demon Emotion Log abbreviated: dEmoLog, is an app prototype that integrates game elements (gamification) to the traditional Mood Diary concept. ");
    			br0 = element("br");
    			t3 = text("\r\n\t\t\t\tThe hope is that with Gamification added, users would have increased motivation to log their moods regularly, thus aiding their management of mental health.");
    			br1 = element("br");
    			t4 = space();
    			br2 = element("br");
    			t5 = space();
    			div1 = element("div");
    			div0 = element("div");
    			label = element("label");
    			label.textContent = "◓";
    			t7 = space();
    			input = element("input");
    			t8 = space();
    			hr = element("hr");
    			t9 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 308, 4, 7180);
    			add_location(br0, file, 309, 155, 7382);
    			add_location(br1, file, 310, 160, 7548);
    			add_location(p, file, 309, 4, 7231);
    			add_location(br2, file, 312, 4, 7568);
    			attr_dev(label, "for", "toggleShowHideCheck");
    			add_location(label, file, 315, 1, 7631);
    			attr_dev(input, "id", "toggleShowHideCheck");
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "class", "check-box");
    			add_location(input, file, 316, 2, 7684);
    			add_location(hr, file, 317, 2, 7788);
    			attr_dev(div0, "id", "blinder");
    			add_location(div0, file, 314, 1, 7610);
    			attr_dev(div1, "id", "right-inner-right");
    			add_location(div1, file, 313, 4, 7578);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			append_dev(p, t2);
    			append_dev(p, br0);
    			append_dev(p, t3);
    			append_dev(p, br1);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, br2, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, label);
    			append_dev(div0, t7);
    			append_dev(div0, input);
    			input.checked = /*showRightInnerLeft*/ ctx[0];
    			append_dev(div0, t8);
    			append_dev(div0, hr);
    			insert_dev(target, t9, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(input, "change", /*input_change_handler*/ ctx[29]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*showRightInnerLeft*/ 1) {
    				input.checked = /*showRightInnerLeft*/ ctx[0];
    			}

    			if (/*showRightInnerLeft*/ ctx[0] === true) {
    				if (if_block) {
    					if (dirty[0] & /*showRightInnerLeft*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_17(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
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
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(br2);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t9);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_16.name,
    		type: "if",
    		source: "(308:3) {#if index === 0}",
    		ctx
    	});

    	return block;
    }

    // (321:2) {#if showRightInnerLeft === true}
    function create_if_block_17(ctx) {
    	let div;
    	let span0;
    	let t1;
    	let span1;
    	let u0;
    	let t3;
    	let p0;
    	let t4;
    	let br0;
    	let t5;
    	let br1;
    	let t6;
    	let br2;
    	let t7;
    	let br3;
    	let t8;
    	let t9;
    	let br4;
    	let t10;
    	let span2;
    	let u1;
    	let t12;
    	let p1;
    	let t13;
    	let br5;
    	let t14;
    	let br6;
    	let t15;
    	let t16;
    	let br7;
    	let t17;
    	let span3;
    	let u2;
    	let t19;
    	let p2;
    	let t20;
    	let br8;
    	let t21;
    	let div_transition;
    	let current;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span0 = element("span");
    			span0.textContent = "Developer Notes";
    			t1 = space();
    			span1 = element("span");
    			u0 = element("u");
    			u0.textContent = "Gamification Integration";
    			t3 = space();
    			p0 = element("p");
    			t4 = text("Some Gamification elements integrated in the app include:");
    			br0 = element("br");
    			t5 = text("\r\n\t\t\t\t\t- Narrative: create an immersive backstory/setting");
    			br1 = element("br");
    			t6 = text("\r\n\t\t\t\t\t- Aesthetic: an specific aesthetic of artwork for further immersion");
    			br2 = element("br");
    			t7 = text("\r\n\t\t\t\t\t- Game Mechanics: taking away mundaneness of emotion logging by turning task into a gaming experience");
    			br3 = element("br");
    			t8 = text("\r\n\t\t\t\t\t- Progression: sustaining user interest by working towards goals in app");
    			t9 = space();
    			br4 = element("br");
    			t10 = space();
    			span2 = element("span");
    			u1 = element("u");
    			u1.textContent = "Experimental Sonification of Emotions";
    			t12 = space();
    			p1 = element("p");
    			t13 = text("-Sonification of Emotions aka, Composition in the app refers to the feature that converts emotions into music.");
    			br5 = element("br");
    			t14 = text("\r\n\t\t\t\t\t- The idea is to allow users to 'listen/playback' their emotions so they could possibly gain insights they otherwise would not if they were to read them traditionally. ");
    			br6 = element("br");
    			t15 = text("\r\n\t\t\t\t\t- Data from each emotion log would be used to generate an emotion piece.");
    			t16 = space();
    			br7 = element("br");
    			t17 = space();
    			span3 = element("span");
    			u2 = element("u");
    			u2.textContent = "Current Progress";
    			t19 = space();
    			p2 = element("p");
    			t20 = text("- Work in progress: Composition");
    			br8 = element("br");
    			t21 = text("\r\n\t\t\t\t\t- Current info is accurate as of 14 Jan 2021");
    			attr_dev(span0, "class", "description-header");
    			add_location(span0, file, 322, 1, 7921);
    			add_location(u0, file, 323, 8, 7986);
    			add_location(span1, file, 323, 2, 7980);
    			add_location(br0, file, 324, 65, 8091);
    			add_location(br1, file, 325, 55, 8152);
    			add_location(br2, file, 326, 72, 8230);
    			add_location(br3, file, 327, 106, 8342);
    			add_location(p0, file, 324, 5, 8031);
    			add_location(br4, file, 330, 4, 8441);
    			add_location(u1, file, 331, 8, 8455);
    			add_location(span2, file, 331, 2, 8449);
    			add_location(br5, file, 332, 118, 8626);
    			add_location(br6, file, 333, 173, 8805);
    			add_location(p1, file, 332, 5, 8513);
    			add_location(br7, file, 336, 4, 8906);
    			add_location(u2, file, 337, 8, 8920);
    			add_location(span3, file, 337, 2, 8914);
    			add_location(br8, file, 338, 39, 8991);
    			add_location(p2, file, 338, 5, 8957);
    			attr_dev(div, "class", "right-inner-left");
    			add_location(div, file, 321, 1, 7850);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span0);
    			append_dev(div, t1);
    			append_dev(div, span1);
    			append_dev(span1, u0);
    			append_dev(div, t3);
    			append_dev(div, p0);
    			append_dev(p0, t4);
    			append_dev(p0, br0);
    			append_dev(p0, t5);
    			append_dev(p0, br1);
    			append_dev(p0, t6);
    			append_dev(p0, br2);
    			append_dev(p0, t7);
    			append_dev(p0, br3);
    			append_dev(p0, t8);
    			append_dev(div, t9);
    			append_dev(div, br4);
    			append_dev(div, t10);
    			append_dev(div, span2);
    			append_dev(span2, u1);
    			append_dev(div, t12);
    			append_dev(div, p1);
    			append_dev(p1, t13);
    			append_dev(p1, br5);
    			append_dev(p1, t14);
    			append_dev(p1, br6);
    			append_dev(p1, t15);
    			append_dev(div, t16);
    			append_dev(div, br7);
    			append_dev(div, t17);
    			append_dev(div, span3);
    			append_dev(span3, u2);
    			append_dev(div, t19);
    			append_dev(div, p2);
    			append_dev(p2, t20);
    			append_dev(p2, br8);
    			append_dev(p2, t21);
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
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_17.name,
    		type: "if",
    		source: "(321:2) {#if showRightInnerLeft === true}",
    		ctx
    	});

    	return block;
    }

    // (348:3) {#if index === 1 && subNavTrack === "" || subNavTrack === "Home"}
    function create_if_block_15(ctx) {
    	let div;
    	let span;
    	let t1;
    	let p;
    	let t3;
    	let br;
    	let t4;
    	let img;
    	let img_src_value;
    	let div_intro;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			span.textContent = "Home";
    			t1 = space();
    			p = element("p");
    			p.textContent = "The Homepage of the app, where you can access to all features.";
    			t3 = space();
    			br = element("br");
    			t4 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 349, 3, 9223);
    			add_location(p, file, 350, 4, 9273);
    			add_location(br, file, 352, 4, 9355);
    			attr_dev(img, "class", "gifHolder");
    			if (img.src !== (img_src_value = "./img/pageItems/home_forever.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "homeGif");
    			add_location(img, file, 353, 4, 9365);
    			add_location(div, file, 348, 3, 9173);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span);
    			append_dev(div, t1);
    			append_dev(div, p);
    			append_dev(div, t3);
    			append_dev(div, br);
    			append_dev(div, t4);
    			append_dev(div, img);
    		},
    		i: function intro(local) {
    			if (!div_intro) {
    				add_render_callback(() => {
    					div_intro = create_in_transition(div, fade, { delay: 100, duration: 300 });
    					div_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_15.name,
    		type: "if",
    		source: "(348:3) {#if index === 1 && subNavTrack === \\\"\\\" || subNavTrack === \\\"Home\\\"}",
    		ctx
    	});

    	return block;
    }

    // (357:4) {#if subNavTrack === "Avatar"}
    function create_if_block_14(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t2;
    	let br0;
    	let t3;
    	let t4;
    	let br1;
    	let t5;
    	let br2;
    	let t6;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Concept: Avatar";
    			t1 = space();
    			p = element("p");
    			t2 = text("In dEmoLog, you are represented as Pens.");
    			br0 = element("br");
    			t3 = text(" I suppose it is fitting seeing you are both the protagonist and author of your own story.");
    			t4 = space();
    			br1 = element("br");
    			t5 = space();
    			br2 = element("br");
    			t6 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 357, 4, 9505);
    			add_location(br0, file, 358, 48, 9610);
    			add_location(p, file, 358, 5, 9567);
    			add_location(br1, file, 359, 5, 9715);
    			add_location(br2, file, 360, 5, 9726);
    			if (img.src !== (img_src_value = "./img/pageItems/qpen.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "quillPen");
    			add_location(img, file, 361, 5, 9737);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			append_dev(p, t2);
    			append_dev(p, br0);
    			append_dev(p, t3);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, br2, anchor);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(br2);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_14.name,
    		type: "if",
    		source: "(357:4) {#if subNavTrack === \\\"Avatar\\\"}",
    		ctx
    	});

    	return block;
    }

    // (365:4) {#if subNavTrack === "Inventory"}
    function create_if_block_13(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t2;
    	let br0;
    	let t3;
    	let t4;
    	let br1;
    	let t5;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Feature: Inventory";
    			t1 = space();
    			p = element("p");
    			t2 = text("Who doesn't like goodies? Gotta store all these loots from demon hunting someplace.");
    			br0 = element("br");
    			t3 = text(" Who knows? They might be useful...");
    			t4 = space();
    			br1 = element("br");
    			t5 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 365, 4, 9852);
    			add_location(br0, file, 366, 91, 10003);
    			add_location(p, file, 366, 5, 9917);
    			add_location(br1, file, 367, 5, 10053);
    			attr_dev(img, "class", "gifHolder");
    			if (img.src !== (img_src_value = "./img/pageItems/inventory_once.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "inventoryGif");
    			add_location(img, file, 368, 5, 10064);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			append_dev(p, t2);
    			append_dev(p, br0);
    			append_dev(p, t3);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_13.name,
    		type: "if",
    		source: "(365:4) {#if subNavTrack === \\\"Inventory\\\"}",
    		ctx
    	});

    	return block;
    }

    // (380:3) {#if index === 2 && subNavTrack === "" || subNavTrack === "Beastiary"}
    function create_if_block_12(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t2;
    	let br0;
    	let t3;
    	let br1;
    	let t4;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Beastiary";
    			t1 = space();
    			p = element("p");
    			t2 = text("The Beastiary page is where information about Demons is stored. ");
    			br0 = element("br");
    			t3 = space();
    			br1 = element("br");
    			t4 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 380, 3, 10665);
    			add_location(br0, file, 381, 71, 10787);
    			add_location(p, file, 381, 4, 10720);
    			add_location(br1, file, 382, 4, 10801);
    			attr_dev(img, "class", "gifHolder");
    			if (img.src !== (img_src_value = "./img/pageItems/beastiary_forever.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "beastiaryGif");
    			add_location(img, file, 383, 4, 10811);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			append_dev(p, t2);
    			append_dev(p, br0);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_12.name,
    		type: "if",
    		source: "(380:3) {#if index === 2 && subNavTrack === \\\"\\\" || subNavTrack === \\\"Beastiary\\\"}",
    		ctx
    	});

    	return block;
    }

    // (386:4) {#if subNavTrack === "Lore"}
    function create_if_block_11(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t3;
    	let br;
    	let t4;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Feature: Lore";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Backstory of each Demons. How quaint. Were they truly monsters to begin with?";
    			t3 = space();
    			br = element("br");
    			t4 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 386, 4, 10948);
    			add_location(p, file, 387, 5, 11008);
    			add_location(br, file, 388, 5, 11099);
    			attr_dev(img, "class", "gifHolder");
    			if (img.src !== (img_src_value = "./img/pageItems/beastiary_lore_once.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "beastiaryLore");
    			add_location(img, file, 389, 5, 11110);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_11.name,
    		type: "if",
    		source: "(386:4) {#if subNavTrack === \\\"Lore\\\"}",
    		ctx
    	});

    	return block;
    }

    // (392:4) {#if subNavTrack === "Select"}
    function create_if_block_10(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t3;
    	let br;
    	let t4;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Feature: Select";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Here's an interesting connection the Beastiary has, to the Mirror world; you can select which Demon you want to Vent at.";
    			t3 = space();
    			br = element("br");
    			t4 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 392, 4, 11253);
    			add_location(p, file, 393, 5, 11315);
    			add_location(br, file, 394, 5, 11449);
    			attr_dev(img, "class", "gifHolder");
    			if (img.src !== (img_src_value = "./img/pageItems/beastiary_select_once.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "beastiarySelect");
    			add_location(img, file, 395, 5, 11460);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10.name,
    		type: "if",
    		source: "(392:4) {#if subNavTrack === \\\"Select\\\"}",
    		ctx
    	});

    	return block;
    }

    // (398:4) {#if subNavTrack === "Unlock"}
    function create_if_block_9(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t3;
    	let br;
    	let t4;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Feature: Unlock";
    			t1 = space();
    			p = element("p");
    			p.textContent = "The Beastiary might know it all but it is not omnipotent. It does however, accept offerings in exchange for new knowledge...";
    			t3 = space();
    			br = element("br");
    			t4 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 398, 4, 11607);
    			add_location(p, file, 399, 5, 11670);
    			add_location(br, file, 400, 5, 11809);
    			attr_dev(img, "class", "gifHolder");
    			if (img.src !== (img_src_value = "./img/pageItems/beastiary_unlock_once.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "beastiaryUnlock");
    			add_location(img, file, 401, 5, 11820);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(398:4) {#if subNavTrack === \\\"Unlock\\\"}",
    		ctx
    	});

    	return block;
    }

    // (404:3) {#if index === 3 && subNavTrack === "" || subNavTrack === "Vent"}
    function create_if_block_8(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t2;
    	let br0;
    	let t3;
    	let br1;
    	let t4;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Vent";
    			t1 = space();
    			p = element("p");
    			t2 = text("The Vent page is where to vanquish demons.");
    			br0 = element("br");
    			t3 = space();
    			br1 = element("br");
    			t4 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 404, 3, 12000);
    			add_location(br0, file, 405, 49, 12095);
    			add_location(p, file, 405, 4, 12050);
    			add_location(br1, file, 406, 4, 12109);
    			attr_dev(img, "class", "gifHolder");
    			if (img.src !== (img_src_value = "./img/pageItems/vent_forever.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "VentGif");
    			add_location(img, file, 407, 5, 12120);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			append_dev(p, t2);
    			append_dev(p, br0);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(404:3) {#if index === 3 && subNavTrack === \\\"\\\" || subNavTrack === \\\"Vent\\\"}",
    		ctx
    	});

    	return block;
    }

    // (410:4) {#if subNavTrack === "Emotion Tomes"}
    function create_if_block_7(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t3;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Concept: Emotion Tomes";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Each emotion tome is representative of an emotion. You are able to wield your emotions through them to launch devastating attacks at demons.";
    			t3 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 410, 4, 12256);
    			add_location(p, file, 411, 5, 12325);
    			attr_dev(img, "width", "600px");
    			if (img.src !== (img_src_value = "./img/pageItems/books.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "emotionTomes");
    			add_location(img, file, 412, 5, 12479);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(410:4) {#if subNavTrack === \\\"Emotion Tomes\\\"}",
    		ctx
    	});

    	return block;
    }

    // (415:4) {#if subNavTrack === "Vanquish"}
    function create_if_block_6(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t2;
    	let br0;
    	let t3;
    	let t4;
    	let br1;
    	let t5;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Feature: Vanquish";
    			t1 = space();
    			p = element("p");
    			t2 = text("Armed with emotion tomes, you can now damage the demon by Venting on them. ");
    			br0 = element("br");
    			t3 = text("\r\n\t\t\t\t\tBut remember to only use the tomes you feel most strongly about otherwise, you won't be getting much out of dEmoLog.");
    			t4 = space();
    			br1 = element("br");
    			t5 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 415, 4, 12605);
    			add_location(br0, file, 416, 83, 12747);
    			add_location(p, file, 416, 5, 12669);
    			add_location(br1, file, 418, 5, 12885);
    			attr_dev(img, "class", "gifHolder");
    			if (img.src !== (img_src_value = "./img/pageItems/vent_vanquish_once.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "VentVanquish");
    			add_location(img, file, 419, 5, 12896);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			append_dev(p, t2);
    			append_dev(p, br0);
    			append_dev(p, t3);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(415:4) {#if subNavTrack === \\\"Vanquish\\\"}",
    		ctx
    	});

    	return block;
    }

    // (422:4) {#if subNavTrack === "Loots"}
    function create_if_block_5(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t2;
    	let br0;
    	let t3;
    	let t4;
    	let br1;
    	let t5;
    	let img0;
    	let img0_src_value;
    	let t6;
    	let img1;
    	let img1_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Feature: Loots";
    			t1 = space();
    			p = element("p");
    			t2 = text("Venting at the demon will drop loots at times. These loots could be useful in the Beastiary... ");
    			br0 = element("br");
    			t3 = text("\r\n\t\t\t\t\tOh, and don't forget to pick them up! They do disappear over time.");
    			t4 = space();
    			br1 = element("br");
    			t5 = space();
    			img0 = element("img");
    			t6 = space();
    			img1 = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 422, 4, 13036);
    			add_location(br0, file, 423, 103, 13195);
    			add_location(p, file, 423, 5, 13097);
    			add_location(br1, file, 425, 5, 13283);
    			attr_dev(img0, "width", "250px");
    			if (img0.src !== (img0_src_value = "./img/pageItems/hornFrag.png")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "hornFragment");
    			add_location(img0, file, 426, 5, 13294);
    			attr_dev(img1, "width", "250px");
    			if (img1.src !== (img1_src_value = "./img/pageItems/branchFrag.png")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "branchFragment");
    			add_location(img1, file, 427, 5, 13375);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			append_dev(p, t2);
    			append_dev(p, br0);
    			append_dev(p, t3);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, img0, anchor);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, img1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(img0);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(img1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(422:4) {#if subNavTrack === \\\"Loots\\\"}",
    		ctx
    	});

    	return block;
    }

    // (430:3) {#if index === 4 && subNavTrack === "" || subNavTrack === "Records"}
    function create_if_block_4(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t3;
    	let br;
    	let t4;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Records";
    			t1 = space();
    			p = element("p");
    			p.textContent = "The Records page acts like an archive of sorts that allows you to look back at your past emotion logs for reflection.";
    			t3 = space();
    			br = element("br");
    			t4 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 430, 3, 13542);
    			add_location(p, file, 431, 4, 13595);
    			add_location(br, file, 432, 4, 13725);
    			attr_dev(img, "class", "gifHolder");
    			if (img.src !== (img_src_value = "./img/pageItems/record_forever.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "recordGif");
    			add_location(img, file, 433, 5, 13736);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(430:3) {#if index === 4 && subNavTrack === \\\"\\\" || subNavTrack === \\\"Records\\\"}",
    		ctx
    	});

    	return block;
    }

    // (436:4) {#if subNavTrack === "Calendar"}
    function create_if_block_3(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t2;
    	let br0;
    	let t3;
    	let t4;
    	let br1;
    	let t5;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Feature: Calendar";
    			t1 = space();
    			p = element("p");
    			t2 = text("You can browse through the calendar to look back at your Vent records.");
    			br0 = element("br");
    			t3 = text("\r\n\t\t\t\t\t Man... I guess I was feeling sad the other day. Huh. How curious.");
    			t4 = space();
    			br1 = element("br");
    			t5 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 436, 4, 13871);
    			add_location(br0, file, 437, 78, 14008);
    			add_location(p, file, 437, 5, 13935);
    			add_location(br1, file, 439, 6, 14098);
    			attr_dev(img, "class", "gifHolder");
    			if (img.src !== (img_src_value = "./img/pageItems/record_calendar_once.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "recordCalendar");
    			add_location(img, file, 440, 5, 14109);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			append_dev(p, t2);
    			append_dev(p, br0);
    			append_dev(p, t3);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(436:4) {#if subNavTrack === \\\"Calendar\\\"}",
    		ctx
    	});

    	return block;
    }

    // (443:4) {#if subNavTrack === "Notes"}
    function create_if_block_2(ctx) {
    	let span;
    	let t1;
    	let p;
    	let t2;
    	let br0;
    	let t3;
    	let t4;
    	let br1;
    	let t5;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Feature: Notes";
    			t1 = space();
    			p = element("p");
    			t2 = text("It might be prudent to edit/append a short note to describe anything else that happened then. ");
    			br0 = element("br");
    			t3 = text("\r\n\t\t\t\t\tI can't believe seeing that stranger shouting far away still made me feel so anxious...");
    			t4 = space();
    			br1 = element("br");
    			t5 = space();
    			img = element("img");
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 443, 4, 14253);
    			add_location(br0, file, 444, 102, 14411);
    			add_location(p, file, 444, 5, 14314);
    			add_location(br1, file, 446, 5, 14520);
    			attr_dev(img, "class", "gifHolder");
    			if (img.src !== (img_src_value = "./img/pageItems/record_edit_once.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "recordEdit");
    			add_location(img, file, 447, 5, 14531);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			append_dev(p, t2);
    			append_dev(p, br0);
    			append_dev(p, t3);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(443:4) {#if subNavTrack === \\\"Notes\\\"}",
    		ctx
    	});

    	return block;
    }

    // (450:3) {#if index === 5 && subNavTrack === "" || subNavTrack === "Composition"}
    function create_if_block_1(ctx) {
    	let span;
    	let t1;
    	let p;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Composition";
    			t1 = space();
    			p = element("p");
    			p.textContent = "\"Recall? Can I recall? Did you know, some people say that music triggers memories.\"";
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 450, 3, 14708);
    			add_location(p, file, 451, 4, 14765);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(450:3) {#if index === 5 && subNavTrack === \\\"\\\" || subNavTrack === \\\"Composition\\\"}",
    		ctx
    	});

    	return block;
    }

    // (454:4) {#if subNavTrack === "-WIP-"}
    function create_if_block(ctx) {
    	let span;
    	let t1;
    	let p;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Work IN progress";
    			t1 = space();
    			p = element("p");
    			p.textContent = "\"test\"";
    			attr_dev(span, "class", "description-header");
    			add_location(span, file, 454, 4, 14906);
    			add_location(p, file, 455, 5, 14969);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(454:4) {#if subNavTrack === \\\"-WIP-\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div6;
    	let div5;
    	let div2;
    	let div0;
    	let p0;
    	let button;
    	let t1;
    	let t2;
    	let div1;
    	let table;
    	let tr0;
    	let td0;
    	let previous_key = /*navImg*/ ctx[3];
    	let t3;
    	let tr1;
    	let td1;
    	let img0;
    	let img0_src_value;
    	let t4;
    	let td2;
    	let previous_key_1 = /*navLabel*/ ctx[4];
    	let t5;
    	let td3;
    	let img1;
    	let img1_src_value;
    	let t6;
    	let br0;
    	let t7;
    	let div4;
    	let t8;
    	let div3;
    	let t9;
    	let t10;
    	let t11;
    	let t12;
    	let t13;
    	let t14;
    	let t15;
    	let t16;
    	let t17;
    	let t18;
    	let t19;
    	let t20;
    	let t21;
    	let t22;
    	let t23;
    	let t24;
    	let t25;
    	let footer;
    	let span;
    	let t27;
    	let br1;
    	let t28;
    	let p1;
    	let t29;
    	let a;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*help*/ ctx[1] === true && create_if_block_24(ctx);
    	let key_block0 = create_key_block_1(ctx);
    	let key_block1 = create_key_block(ctx);
    	let if_block1 = /*index*/ ctx[2] != 0 && create_if_block_18(ctx);
    	let if_block2 = /*index*/ ctx[2] === 0 && create_if_block_16(ctx);
    	let if_block3 = (/*index*/ ctx[2] === 1 && /*subNavTrack*/ ctx[5] === "" || /*subNavTrack*/ ctx[5] === "Home") && create_if_block_15(ctx);
    	let if_block4 = /*subNavTrack*/ ctx[5] === "Avatar" && create_if_block_14(ctx);
    	let if_block5 = /*subNavTrack*/ ctx[5] === "Inventory" && create_if_block_13(ctx);
    	let if_block6 = (/*index*/ ctx[2] === 2 && /*subNavTrack*/ ctx[5] === "" || /*subNavTrack*/ ctx[5] === "Beastiary") && create_if_block_12(ctx);
    	let if_block7 = /*subNavTrack*/ ctx[5] === "Lore" && create_if_block_11(ctx);
    	let if_block8 = /*subNavTrack*/ ctx[5] === "Select" && create_if_block_10(ctx);
    	let if_block9 = /*subNavTrack*/ ctx[5] === "Unlock" && create_if_block_9(ctx);
    	let if_block10 = (/*index*/ ctx[2] === 3 && /*subNavTrack*/ ctx[5] === "" || /*subNavTrack*/ ctx[5] === "Vent") && create_if_block_8(ctx);
    	let if_block11 = /*subNavTrack*/ ctx[5] === "Emotion Tomes" && create_if_block_7(ctx);
    	let if_block12 = /*subNavTrack*/ ctx[5] === "Vanquish" && create_if_block_6(ctx);
    	let if_block13 = /*subNavTrack*/ ctx[5] === "Loots" && create_if_block_5(ctx);
    	let if_block14 = (/*index*/ ctx[2] === 4 && /*subNavTrack*/ ctx[5] === "" || /*subNavTrack*/ ctx[5] === "Records") && create_if_block_4(ctx);
    	let if_block15 = /*subNavTrack*/ ctx[5] === "Calendar" && create_if_block_3(ctx);
    	let if_block16 = /*subNavTrack*/ ctx[5] === "Notes" && create_if_block_2(ctx);
    	let if_block17 = (/*index*/ ctx[2] === 5 && /*subNavTrack*/ ctx[5] === "" || /*subNavTrack*/ ctx[5] === "Composition") && create_if_block_1(ctx);
    	let if_block18 = /*subNavTrack*/ ctx[5] === "-WIP-" && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div5 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			p0 = element("p");
    			button = element("button");
    			button.textContent = "☰";
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			div1 = element("div");
    			table = element("table");
    			tr0 = element("tr");
    			td0 = element("td");
    			key_block0.c();
    			t3 = space();
    			tr1 = element("tr");
    			td1 = element("td");
    			img0 = element("img");
    			t4 = space();
    			td2 = element("td");
    			key_block1.c();
    			t5 = space();
    			td3 = element("td");
    			img1 = element("img");
    			t6 = space();
    			br0 = element("br");
    			t7 = space();
    			div4 = element("div");
    			if (if_block1) if_block1.c();
    			t8 = space();
    			div3 = element("div");
    			if (if_block2) if_block2.c();
    			t9 = space();
    			if (if_block3) if_block3.c();
    			t10 = space();
    			if (if_block4) if_block4.c();
    			t11 = space();
    			if (if_block5) if_block5.c();
    			t12 = space();
    			if (if_block6) if_block6.c();
    			t13 = space();
    			if (if_block7) if_block7.c();
    			t14 = space();
    			if (if_block8) if_block8.c();
    			t15 = space();
    			if (if_block9) if_block9.c();
    			t16 = space();
    			if (if_block10) if_block10.c();
    			t17 = space();
    			if (if_block11) if_block11.c();
    			t18 = space();
    			if (if_block12) if_block12.c();
    			t19 = space();
    			if (if_block13) if_block13.c();
    			t20 = space();
    			if (if_block14) if_block14.c();
    			t21 = space();
    			if (if_block15) if_block15.c();
    			t22 = space();
    			if (if_block16) if_block16.c();
    			t23 = space();
    			if (if_block17) if_block17.c();
    			t24 = space();
    			if (if_block18) if_block18.c();
    			t25 = space();
    			footer = element("footer");
    			span = element("span");
    			span.textContent = "dEmoLog";
    			t27 = space();
    			br1 = element("br");
    			t28 = space();
    			p1 = element("p");
    			t29 = text("created by ");
    			a = element("a");
    			a.textContent = "5v1n0";
    			attr_dev(button, "id", "tutBtn");
    			add_location(button, file, 183, 5, 4070);
    			add_location(p0, file, 183, 2, 4067);
    			attr_dev(div0, "id", "help");
    			add_location(div0, file, 182, 2, 4048);
    			attr_dev(td0, "colspan", "3");
    			attr_dev(td0, "class", "fixedImgHolder");
    			add_location(td0, file, 218, 3, 4980);
    			add_location(tr0, file, 217, 3, 4971);
    			attr_dev(img0, "id", "sliderBtn");
    			if (img0.src !== (img0_src_value = "./img/UI/arrow_L.png")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "leftArrow");
    			add_location(img0, file, 225, 7, 5204);
    			add_location(td1, file, 225, 3, 5200);
    			add_location(td2, file, 226, 4, 5320);
    			attr_dev(img1, "id", "sliderBtn");
    			if (img1.src !== (img1_src_value = "./img/UI/arrow_R.png")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "rightArrow");
    			add_location(img1, file, 230, 7, 5461);
    			add_location(td3, file, 230, 3, 5457);
    			attr_dev(tr1, "class", "fixedLabelHolder");
    			add_location(tr1, file, 224, 3, 5166);
    			add_location(table, file, 216, 3, 4959);
    			add_location(br0, file, 234, 3, 5606);
    			attr_dev(div1, "id", "scroller");
    			add_location(div1, file, 214, 3, 4930);
    			attr_dev(div2, "class", "COF-wheel");
    			add_location(div2, file, 181, 2, 4021);
    			attr_dev(div3, "class", "introBox");
    			add_location(div3, file, 306, 3, 7130);
    			attr_dev(div4, "class", "song-detail");
    			add_location(div4, file, 242, 2, 5678);
    			attr_dev(div5, "class", "mini-container");
    			add_location(div5, file, 180, 1, 3989);
    			attr_dev(div6, "class", "container");
    			add_location(div6, file, 179, 0, 3963);
    			attr_dev(span, "id", "dEmoLog");
    			add_location(span, file, 465, 2, 15075);
    			add_location(br1, file, 466, 2, 15138);
    			attr_dev(a, "href", "https://github.com/5v1n0");
    			attr_dev(a, "target", "_blank");
    			add_location(a, file, 467, 16, 15160);
    			add_location(p1, file, 467, 2, 15146);
    			add_location(footer, file, 464, 1, 15063);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div5);
    			append_dev(div5, div2);
    			append_dev(div2, div0);
    			append_dev(div0, p0);
    			append_dev(p0, button);
    			append_dev(div0, t1);
    			if (if_block0) if_block0.m(div0, null);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div1, table);
    			append_dev(table, tr0);
    			append_dev(tr0, td0);
    			key_block0.m(td0, null);
    			append_dev(table, t3);
    			append_dev(table, tr1);
    			append_dev(tr1, td1);
    			append_dev(td1, img0);
    			append_dev(tr1, t4);
    			append_dev(tr1, td2);
    			key_block1.m(td2, null);
    			append_dev(tr1, t5);
    			append_dev(tr1, td3);
    			append_dev(td3, img1);
    			append_dev(div1, t6);
    			append_dev(div1, br0);
    			append_dev(div5, t7);
    			append_dev(div5, div4);
    			if (if_block1) if_block1.m(div4, null);
    			append_dev(div4, t8);
    			append_dev(div4, div3);
    			if (if_block2) if_block2.m(div3, null);
    			append_dev(div3, t9);
    			if (if_block3) if_block3.m(div3, null);
    			append_dev(div3, t10);
    			if (if_block4) if_block4.m(div3, null);
    			append_dev(div3, t11);
    			if (if_block5) if_block5.m(div3, null);
    			append_dev(div3, t12);
    			if (if_block6) if_block6.m(div3, null);
    			append_dev(div3, t13);
    			if (if_block7) if_block7.m(div3, null);
    			append_dev(div3, t14);
    			if (if_block8) if_block8.m(div3, null);
    			append_dev(div3, t15);
    			if (if_block9) if_block9.m(div3, null);
    			append_dev(div3, t16);
    			if (if_block10) if_block10.m(div3, null);
    			append_dev(div3, t17);
    			if (if_block11) if_block11.m(div3, null);
    			append_dev(div3, t18);
    			if (if_block12) if_block12.m(div3, null);
    			append_dev(div3, t19);
    			if (if_block13) if_block13.m(div3, null);
    			append_dev(div3, t20);
    			if (if_block14) if_block14.m(div3, null);
    			append_dev(div3, t21);
    			if (if_block15) if_block15.m(div3, null);
    			append_dev(div3, t22);
    			if (if_block16) if_block16.m(div3, null);
    			append_dev(div3, t23);
    			if (if_block17) if_block17.m(div3, null);
    			append_dev(div3, t24);
    			if (if_block18) if_block18.m(div3, null);
    			insert_dev(target, t25, anchor);
    			insert_dev(target, footer, anchor);
    			append_dev(footer, span);
    			append_dev(footer, t27);
    			append_dev(footer, br1);
    			append_dev(footer, t28);
    			append_dev(footer, p1);
    			append_dev(p1, t29);
    			append_dev(p1, a);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*click_handler*/ ctx[15], false, false, false),
    					listen_dev(img0, "click", /*click_handler_7*/ ctx[22], false, false, false),
    					listen_dev(img1, "click", /*click_handler_8*/ ctx[23], false, false, false),
    					listen_dev(span, "click", /*click_handler_14*/ ctx[30], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*help*/ ctx[1] === true) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty[0] & /*help*/ 2) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_24(ctx);
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

    			if (dirty[0] & /*navImg*/ 8 && safe_not_equal(previous_key, previous_key = /*navImg*/ ctx[3])) {
    				group_outros();
    				transition_out(key_block0, 1, 1, noop);
    				check_outros();
    				key_block0 = create_key_block_1(ctx);
    				key_block0.c();
    				transition_in(key_block0);
    				key_block0.m(td0, null);
    			} else {
    				key_block0.p(ctx, dirty);
    			}

    			if (dirty[0] & /*navLabel*/ 16 && safe_not_equal(previous_key_1, previous_key_1 = /*navLabel*/ ctx[4])) {
    				group_outros();
    				transition_out(key_block1, 1, 1, noop);
    				check_outros();
    				key_block1 = create_key_block(ctx);
    				key_block1.c();
    				transition_in(key_block1);
    				key_block1.m(td2, null);
    			} else {
    				key_block1.p(ctx, dirty);
    			}

    			if (/*index*/ ctx[2] != 0) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_18(ctx);
    					if_block1.c();
    					if_block1.m(div4, t8);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*index*/ ctx[2] === 0) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty[0] & /*index*/ 4) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_16(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div3, t9);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if (/*index*/ ctx[2] === 1 && /*subNavTrack*/ ctx[5] === "" || /*subNavTrack*/ ctx[5] === "Home") {
    				if (if_block3) {
    					if (dirty[0] & /*index, subNavTrack*/ 36) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block_15(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(div3, t10);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*subNavTrack*/ ctx[5] === "Avatar") {
    				if (if_block4) ; else {
    					if_block4 = create_if_block_14(ctx);
    					if_block4.c();
    					if_block4.m(div3, t11);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (/*subNavTrack*/ ctx[5] === "Inventory") {
    				if (if_block5) ; else {
    					if_block5 = create_if_block_13(ctx);
    					if_block5.c();
    					if_block5.m(div3, t12);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}

    			if (/*index*/ ctx[2] === 2 && /*subNavTrack*/ ctx[5] === "" || /*subNavTrack*/ ctx[5] === "Beastiary") {
    				if (if_block6) ; else {
    					if_block6 = create_if_block_12(ctx);
    					if_block6.c();
    					if_block6.m(div3, t13);
    				}
    			} else if (if_block6) {
    				if_block6.d(1);
    				if_block6 = null;
    			}

    			if (/*subNavTrack*/ ctx[5] === "Lore") {
    				if (if_block7) ; else {
    					if_block7 = create_if_block_11(ctx);
    					if_block7.c();
    					if_block7.m(div3, t14);
    				}
    			} else if (if_block7) {
    				if_block7.d(1);
    				if_block7 = null;
    			}

    			if (/*subNavTrack*/ ctx[5] === "Select") {
    				if (if_block8) ; else {
    					if_block8 = create_if_block_10(ctx);
    					if_block8.c();
    					if_block8.m(div3, t15);
    				}
    			} else if (if_block8) {
    				if_block8.d(1);
    				if_block8 = null;
    			}

    			if (/*subNavTrack*/ ctx[5] === "Unlock") {
    				if (if_block9) ; else {
    					if_block9 = create_if_block_9(ctx);
    					if_block9.c();
    					if_block9.m(div3, t16);
    				}
    			} else if (if_block9) {
    				if_block9.d(1);
    				if_block9 = null;
    			}

    			if (/*index*/ ctx[2] === 3 && /*subNavTrack*/ ctx[5] === "" || /*subNavTrack*/ ctx[5] === "Vent") {
    				if (if_block10) ; else {
    					if_block10 = create_if_block_8(ctx);
    					if_block10.c();
    					if_block10.m(div3, t17);
    				}
    			} else if (if_block10) {
    				if_block10.d(1);
    				if_block10 = null;
    			}

    			if (/*subNavTrack*/ ctx[5] === "Emotion Tomes") {
    				if (if_block11) ; else {
    					if_block11 = create_if_block_7(ctx);
    					if_block11.c();
    					if_block11.m(div3, t18);
    				}
    			} else if (if_block11) {
    				if_block11.d(1);
    				if_block11 = null;
    			}

    			if (/*subNavTrack*/ ctx[5] === "Vanquish") {
    				if (if_block12) ; else {
    					if_block12 = create_if_block_6(ctx);
    					if_block12.c();
    					if_block12.m(div3, t19);
    				}
    			} else if (if_block12) {
    				if_block12.d(1);
    				if_block12 = null;
    			}

    			if (/*subNavTrack*/ ctx[5] === "Loots") {
    				if (if_block13) ; else {
    					if_block13 = create_if_block_5(ctx);
    					if_block13.c();
    					if_block13.m(div3, t20);
    				}
    			} else if (if_block13) {
    				if_block13.d(1);
    				if_block13 = null;
    			}

    			if (/*index*/ ctx[2] === 4 && /*subNavTrack*/ ctx[5] === "" || /*subNavTrack*/ ctx[5] === "Records") {
    				if (if_block14) ; else {
    					if_block14 = create_if_block_4(ctx);
    					if_block14.c();
    					if_block14.m(div3, t21);
    				}
    			} else if (if_block14) {
    				if_block14.d(1);
    				if_block14 = null;
    			}

    			if (/*subNavTrack*/ ctx[5] === "Calendar") {
    				if (if_block15) ; else {
    					if_block15 = create_if_block_3(ctx);
    					if_block15.c();
    					if_block15.m(div3, t22);
    				}
    			} else if (if_block15) {
    				if_block15.d(1);
    				if_block15 = null;
    			}

    			if (/*subNavTrack*/ ctx[5] === "Notes") {
    				if (if_block16) ; else {
    					if_block16 = create_if_block_2(ctx);
    					if_block16.c();
    					if_block16.m(div3, t23);
    				}
    			} else if (if_block16) {
    				if_block16.d(1);
    				if_block16 = null;
    			}

    			if (/*index*/ ctx[2] === 5 && /*subNavTrack*/ ctx[5] === "" || /*subNavTrack*/ ctx[5] === "Composition") {
    				if (if_block17) ; else {
    					if_block17 = create_if_block_1(ctx);
    					if_block17.c();
    					if_block17.m(div3, t24);
    				}
    			} else if (if_block17) {
    				if_block17.d(1);
    				if_block17 = null;
    			}

    			if (/*subNavTrack*/ ctx[5] === "-WIP-") {
    				if (if_block18) ; else {
    					if_block18 = create_if_block(ctx);
    					if_block18.c();
    					if_block18.m(div3, null);
    				}
    			} else if (if_block18) {
    				if_block18.d(1);
    				if_block18 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(key_block0);
    			transition_in(key_block1);
    			transition_in(if_block2);
    			transition_in(if_block3);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(key_block0);
    			transition_out(key_block1);
    			transition_out(if_block2);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			if (if_block0) if_block0.d();
    			key_block0.d(detaching);
    			key_block1.d(detaching);
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    			if (if_block6) if_block6.d();
    			if (if_block7) if_block7.d();
    			if (if_block8) if_block8.d();
    			if (if_block9) if_block9.d();
    			if (if_block10) if_block10.d();
    			if (if_block11) if_block11.d();
    			if (if_block12) if_block12.d();
    			if (if_block13) if_block13.d();
    			if (if_block14) if_block14.d();
    			if (if_block15) if_block15.d();
    			if (if_block16) if_block16.d();
    			if (if_block17) if_block17.d();
    			if (if_block18) if_block18.d();
    			if (detaching) detach_dev(t25);
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
    	let showRightInnerLeft = false;
    	let error = false;
    	let intro = true;
    	let help = false;
    	let readyToNodeWheel = false;
    	let loadedCoords = false;
    	let index = 0; // page load, default index
    	let max = 5; // how many pages there are
    	let navImg = "./img/UI/pg" + index + ".png";
    	let navLabel = "dEmoLog";
    	let subNavTrack = "";
    	let HomeArr = ["Home", "Avatar", "Inventory"];
    	let BeastArr = ["Beastiary", "Lore", "Select", "Unlock"];
    	let VentArr = ["Vent", "Emotion Tomes", "Loots", "Vanquish"];
    	let RecordsArr = ["Records", "Calendar", "Notes"];
    	let CompArr = ["Composition", "-WIP-"];

    	function toggleTutorial() {
    		toggleGif = 0;
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
    			toggleGif = 0;
    			currTut = 0;
    		} else {
    			currTut = target;
    			toggleGif = target;
    		}
    	}

    	function scrollMenu(currentIndex, direction) {
    		if (direction === "left") {
    			if (currentIndex === 0) {
    				$$invalidate(2, index = max);
    				$$invalidate(3, navImg = "./img/UI/pg" + index + ".png");
    				scrollLabel(index);
    				$$invalidate(5, subNavTrack = "");
    			} else {
    				$$invalidate(2, index = currentIndex - 1);
    				$$invalidate(3, navImg = "./img/UI/pg" + index + ".png");
    				scrollLabel(index);
    				$$invalidate(5, subNavTrack = "");
    			}
    		}

    		if (direction === "right") {
    			if (currentIndex === max) {
    				$$invalidate(2, index = 0);
    				$$invalidate(3, navImg = "./img/UI/pg" + index + ".png");
    				scrollLabel(index);
    				$$invalidate(5, subNavTrack = "");
    			} else {
    				$$invalidate(2, index = currentIndex + 1);
    				$$invalidate(3, navImg = "./img/UI/pg" + index + ".png");
    				scrollLabel(index);
    				$$invalidate(5, subNavTrack = "");
    			}
    		}
    	}

    	function scrollLabel(currentPage) {
    		switch (currentPage) {
    			case 0:
    				$$invalidate(4, navLabel = "dEmoLog");
    				break;
    			case 1:
    				$$invalidate(4, navLabel = "Home");
    				break;
    			case 2:
    				$$invalidate(4, navLabel = "Beastiary");
    				break;
    			case 3:
    				$$invalidate(4, navLabel = "Vent");
    				break;
    			case 4:
    				$$invalidate(4, navLabel = "Records");
    				break;
    			case 5:
    				$$invalidate(4, navLabel = "Composition");
    				break;
    			default:
    				$$invalidate(4, navLabel = "dEmoLog");
    				break;
    		}
    	}

    	function altNav(page) {
    		scrollLabel(page);
    		$$invalidate(3, navImg = "./img/UI/pg" + page + ".png");
    		$$invalidate(2, index = page);
    		$$invalidate(5, subNavTrack = "");
    	}

    	let aHistory = "";
    	let aCurrent = "";

    	function handleSubNav(subNav, i) {
    		aCurrent = document.getElementById(subNav + i);

    		if (aHistory === "") {
    			aHistory = aCurrent; // if empty at start, set both history and selection as selected.
    			aCurrent.style.background = "#f6f6f6";
    		}

    		if (aCurrent !== aHistory) {
    			aHistory.style.background = "#EDEAE5"; //if selecting different li
    			// history li to not highlighted

    			aCurrent.style.background = "#f6f6f6"; // 
    			aHistory = aCurrent;
    		}

    		$$invalidate(5, subNavTrack = subNav);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => toggleTutorial();
    	const click_handler_1 = () => altNav(0);
    	const click_handler_2 = () => altNav(1);
    	const click_handler_3 = () => altNav(2);
    	const click_handler_4 = () => altNav(3);
    	const click_handler_5 = () => altNav(4);
    	const click_handler_6 = () => altNav(5);
    	const click_handler_7 = () => scrollMenu(index, "left");
    	const click_handler_8 = () => scrollMenu(index, "right");
    	const click_handler_9 = (subNav, i) => handleSubNav(subNav, i);
    	const click_handler_10 = (subNav, i) => handleSubNav(subNav, i);
    	const click_handler_11 = (subNav, i) => handleSubNav(subNav, i);
    	const click_handler_12 = (subNav, i) => handleSubNav(subNav, i);
    	const click_handler_13 = (subNav, i) => handleSubNav(subNav, i);

    	function input_change_handler() {
    		showRightInnerLeft = this.checked;
    		$$invalidate(0, showRightInnerLeft);
    	}

    	const click_handler_14 = () => altNav(0);

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
    		index,
    		max,
    		navImg,
    		navLabel,
    		subNavTrack,
    		HomeArr,
    		BeastArr,
    		VentArr,
    		RecordsArr,
    		CompArr,
    		toggleTutorial,
    		toggleGif,
    		currTut,
    		toggleGifBlinder,
    		pingTutorialIn,
    		pingTutorialOut,
    		scrollMenu,
    		scrollLabel,
    		altNav,
    		aHistory,
    		aCurrent,
    		handleSubNav
    	});

    	$$self.$inject_state = $$props => {
    		if ("visible" in $$props) visible = $$props.visible;
    		if ("showDetail" in $$props) showDetail = $$props.showDetail;
    		if ("showSongs" in $$props) showSongs = $$props.showSongs;
    		if ("showSwatch" in $$props) showSwatch = $$props.showSwatch;
    		if ("showOverheadChords" in $$props) showOverheadChords = $$props.showOverheadChords;
    		if ("showRightInnerLeft" in $$props) $$invalidate(0, showRightInnerLeft = $$props.showRightInnerLeft);
    		if ("error" in $$props) error = $$props.error;
    		if ("intro" in $$props) intro = $$props.intro;
    		if ("help" in $$props) $$invalidate(1, help = $$props.help);
    		if ("readyToNodeWheel" in $$props) readyToNodeWheel = $$props.readyToNodeWheel;
    		if ("loadedCoords" in $$props) loadedCoords = $$props.loadedCoords;
    		if ("index" in $$props) $$invalidate(2, index = $$props.index);
    		if ("max" in $$props) max = $$props.max;
    		if ("navImg" in $$props) $$invalidate(3, navImg = $$props.navImg);
    		if ("navLabel" in $$props) $$invalidate(4, navLabel = $$props.navLabel);
    		if ("subNavTrack" in $$props) $$invalidate(5, subNavTrack = $$props.subNavTrack);
    		if ("HomeArr" in $$props) $$invalidate(6, HomeArr = $$props.HomeArr);
    		if ("BeastArr" in $$props) $$invalidate(7, BeastArr = $$props.BeastArr);
    		if ("VentArr" in $$props) $$invalidate(8, VentArr = $$props.VentArr);
    		if ("RecordsArr" in $$props) $$invalidate(9, RecordsArr = $$props.RecordsArr);
    		if ("CompArr" in $$props) $$invalidate(10, CompArr = $$props.CompArr);
    		if ("toggleGif" in $$props) toggleGif = $$props.toggleGif;
    		if ("currTut" in $$props) currTut = $$props.currTut;
    		if ("aHistory" in $$props) aHistory = $$props.aHistory;
    		if ("aCurrent" in $$props) aCurrent = $$props.aCurrent;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		showRightInnerLeft,
    		help,
    		index,
    		navImg,
    		navLabel,
    		subNavTrack,
    		HomeArr,
    		BeastArr,
    		VentArr,
    		RecordsArr,
    		CompArr,
    		toggleTutorial,
    		scrollMenu,
    		altNav,
    		handleSubNav,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7,
    		click_handler_8,
    		click_handler_9,
    		click_handler_10,
    		click_handler_11,
    		click_handler_12,
    		click_handler_13,
    		input_change_handler,
    		click_handler_14
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, [-1, -1]);

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
