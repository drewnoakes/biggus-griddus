/**
 * @author Drew Noakes https://drewnoakes.com
 */

function dereferencePath(obj: Object, pathParts: string[]): any
{
    var i = 0;
    while (obj && i < pathParts.length)
        obj = obj[pathParts[i++]];
    return obj;
}

function toFixedFix(n: number, prec: number): number
{
    // Fix for IE parseFloat(0.55).toFixed(0) = 0;
    var k = Math.pow(10, prec);
    return Math.round(n * k) / k;
}

function formatNumber(num: number, decimals: number)
{
    var n = !isFinite(+num) ? 0 : +num,
        prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
        s = (prec ? toFixedFix(n, prec) : Math.round(n)).toString().split('.');

    if (s[0].length > 3)
    {
        s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, ',');
    }

    if ((s[1] || '').length < prec)
    {
        s[1] = s[1] || '';
        s[1] += new Array(prec - s[1].length + 1).join('0');
    }

    return s.join('.');
}

export interface IColumn<TRow>
{
    /** Populate and style the column's header element. */
    styleHeader(th: HTMLTableHeaderCellElement): void;
    /** Populate and style a column cell element. */
    styleCell(td: HTMLTableCellElement, row: TRow): void;

    /** Indicates whether this column may be sorted using getSortValue. */
    isSortable: boolean;
    /** Returns a value for a given row that can be used when sorting this column. */
    getSortValue(row: TRow): any;

    /** Indicates whether this column supports filtering, and if so, via what means. */
    isFilterable: boolean;
    isFiltering: boolean;
    /** Fires when <code>filterPredicate</code> changes, and when <code>isFiltering</code> changes. */
    filterChanged: Event<IColumn<TRow>>;
    filterPredicate: (item: TRow)=>boolean;

    getDefaultSortDirection(): SortDirection;
}

export interface IColumnOptions<TRow>
{
    /** Text to show in the column's header. */
    title?: string;
    /** A CSS class name to apply to all th/td elements in the column. */
    className?: string;
    /** A function that styles the header (th) of the column. */
    thStyle?: (th: HTMLTableHeaderCellElement)=>void;
    /** A function that styles the data cells (td) of the column. */
    tdStyle?: (td: HTMLTableCellElement, row: TRow)=>void;
    /** Whether the column should sort ascending or descending by default. Optional. */
    defaultSortDirection?: SortDirection;
}

export interface ITextColumnOptions<TRow> extends IColumnOptions<TRow>
{
    /** A dot-separated path to the value on the row object. */
    path?: string;
    /** A function that returns the text to display for this column/row. */
    value?: (row: TRow)=>any;
}

export class ColumnBase<TRow> implements IColumn<TRow>
{
    public isSortable: boolean;

    public isFilterable: boolean = false;
    public isFiltering: boolean = false;
    public filterChanged: Event<IColumn<TRow>> = new Event<IColumn<TRow>>();
    public filterPredicate: (item: TRow)=>boolean;

    constructor(private optionsBase: IColumnOptions<TRow>)
    {
        this.isSortable = true;
    }

    public styleHeader(th: HTMLTableHeaderCellElement)
    {
        if (this.optionsBase.title)
            th.textContent = this.optionsBase.title;

        if (this.optionsBase.className)
            th.className = this.optionsBase.className;

        if (this.optionsBase.thStyle)
            this.optionsBase.thStyle(th);
    }

    /**
     * Sets the class name (if specified) and calls the styling callback (if specified.)
     * Subclasses should set text content or add child nodes as required, then call this base implementation.
     */
    public styleCell(td: HTMLTableCellElement, row: TRow)
    {
        if (this.optionsBase.className)
            td.className = this.optionsBase.className;

        if (this.optionsBase.tdStyle)
            this.optionsBase.tdStyle(td, row);
    }

    public getSortValue(row: TRow): any { return 0; }

    public getDefaultSortDirection()
    {
        if (this.optionsBase.defaultSortDirection)
            return this.optionsBase.defaultSortDirection;
        else
            return SortDirection.Descending;
    }
}

export class TextColumn<TRow> extends ColumnBase<TRow>
{
    public pathParts: string[];

    constructor(private options: ITextColumnOptions<TRow>)
    {
        super(options);

        if (!options.path == !options.value)
            throw new Error("Must provide one of path or value properties.");

        if (options.path)
            this.pathParts = options.path.split('.');

        this.isFilterable = true;
    }

    public getText(row: TRow): string
    {
        try
        {
            if (this.pathParts)
            {
                var value = dereferencePath(row, this.pathParts);
                if (value != null)
                    return value.toString();
            }
            else
            {
                console.assert(!!this.options.value);
                var value = this.options.value(row);
                return value ? value.toString() : '';
            }
        }
        catch (err)
        {
            return 'ERROR';
        }
    }

    public styleCell(td: HTMLTableCellElement, row: TRow)
    {
        var text = this.getText(row);

        if (text != null)
            td.textContent = text;

        super.styleCell(td, row);
    }

    public getSortValue(row: TRow): any
    {
        try
        {
            return this.pathParts
                ? dereferencePath(row, this.pathParts)
                : this.options.value(row);
        }
        catch (err)
        {
            return undefined;
        }
    }

    public setFilterText(text: string)
    {
        if (!!text)
        {
            // TODO do we want to try and escape the regex here? some users will like regex, others will find it surprising
            this.isFiltering = true;
            try
            {
                var regex = new RegExp(text, "i");
                this.filterPredicate = (item: TRow) => regex.test(this.getText(item));
            }
            catch (err)
            {
                // Unable to parse the expression as a regex, so treat it as plain text
                this.filterPredicate = (item: TRow) => this.getText(item).indexOf(text) !== -1;
            }
        }
        else
        {
            this.isFiltering = false;
            this.filterPredicate = null;
        }
        this.filterChanged.raise(this);
    }

    public getDefaultSortDirection()
    {
        if (this.options.defaultSortDirection)
            return this.options.defaultSortDirection;
        else
            return SortDirection.Ascending;
    }
}

/** A column that presents its contents in a solid tile positioned within the cell and not necessarily flush to its edges. */
export class TextTileColumn<TRow> extends TextColumn<TRow>
{
    constructor(options: ITextColumnOptions<TRow>)
    {
        super(options);
    }

    public styleCell(td: HTMLTableCellElement, row: TRow)
    {
        super.styleCell(td, row);

        var text = td.textContent;

        td.textContent = null;

        var div = document.createElement('div');
        div.textContent = text;
        div.className = 'tile';
        td.appendChild(div);
    }
}

export interface INumericColumnOptions<TRow> extends IColumnOptions<TRow>
{
    /** A dot-separated path to the value on the row object. */
    path?: string;
    /** A function that returns the text to display for this column/row. */
    value?: (row: TRow)=>number;
    /** The number of decimal places after the zero to display. */
    precision?: number;
    /** Whether to hide zero valued cells. Default to false. */
    hideZero?: boolean;
    /** Whether to hide NaN valued cells. Default to false. */
    hideNaN?: boolean;
    /** Whether to sort on absolute numeric values. Defaults to false. */
    sortAbsolute?: boolean;
}

export class NumericColumn<TRow> extends TextColumn<TRow>
{
    constructor(private numericOptions: INumericColumnOptions<TRow>)
    {
        super(numericOptions);

        // TODO implement filtering for numeric columns
        this.isFilterable = false;

        if (this.numericOptions.precision == null) this.numericOptions.precision = 0;
        if (this.numericOptions.hideZero == null) this.numericOptions.hideZero = false;
    }

    public styleCell(td: HTMLTableCellElement, row: TRow)
    {
        super.styleCell(td, row);
        td.classList.add('numeric');
    }

    public styleHeader(th: HTMLTableHeaderCellElement)
    {
        super.styleHeader(th);
        th.classList.add('numeric');
    }

    public getText(row: TRow): string
    {
        var value: any;
        try
        {
            value = this.pathParts
                ? dereferencePath(row, this.pathParts)
                : this.numericOptions.value(row);
        }
        catch (err)
        {
            value = 'ERROR';
        }

        if (value == null)
            return '';

        console.assert(typeof(value) === 'number');

        if (value === 0 && this.numericOptions.hideZero)
            return '';

        if (isNaN(value) && this.numericOptions.hideNaN)
            return '';

        return formatNumber(value, this.numericOptions.precision);
    }

    public getSortValue(row: TRow): any
    {
        var value;
        try
        {
            value = super.getSortValue(row);
        }
        catch (err)
        {
            return undefined;
        }
        if (isNaN(value) || value == null)
            return undefined;
        return this.numericOptions.sortAbsolute
            ? Math.abs(value)
            : value;
    }

    public getDefaultSortDirection()
    {
        if (this.numericOptions.defaultSortDirection)
            return this.numericOptions.defaultSortDirection;
        else
            return SortDirection.Descending;
    }
}

export interface IImageColumnOptions<TRow> extends IColumnOptions<TRow>
{
    /** A dot-separated path to the value on the row object. */
    url?: string;
    lowerCase?: boolean;
    /** Indicates whether this column may be sorted. Defaults to false. */
    isSortable?: boolean;
}

var imagePathRegExp = new RegExp('^(.*)\\{(.*)\\}(.*)$');

export class ImageColumn<TRow> extends ColumnBase<TRow>
{
    private pathParts: string[];
    private urlPrefix: string;
    private urlSuffix: string;

    constructor(private options: IImageColumnOptions<TRow>)
    {
        super(options);

        this.isSortable = !!options.isSortable;

        if (!options.url)
            throw new Error("Must provide a url.");

        var groups = imagePathRegExp.exec(options.url);
        this.urlPrefix = groups[1];
        this.pathParts = groups[2].split('.');
        this.urlSuffix = groups[3];
    }

    public styleCell(td: HTMLTableCellElement, row: TRow)
    {
        var data = dereferencePath(row, this.pathParts);
        if (data)
        {
            var img = new Image();
            var src = this.urlPrefix + data + this.urlSuffix;
            if (this.options.lowerCase)
                src = src.toLowerCase();
            img.src = src;
            td.appendChild(img);
        }

        super.styleCell(td, row);
    }
}

export interface ISpriteImageColumn<TRow> extends IColumnOptions<TRow>
{
    value: (row:TRow) => string;
    spriteClassPrefix: string;
}

export class SpriteImageColumn<TRow> extends ColumnBase<TRow>
{
    constructor(private options: ISpriteImageColumn<TRow>)
    {
        super(options);
    }

    public styleCell(td: HTMLTableCellElement, row: TRow)
    {
        try
        {
            var d = document.createElement('div');
            var val = this.options.value(row);
            if (val)
            {
                d.className = this.options.spriteClassPrefix;
                d.classList.add(val);
            }
            td.appendChild(d);
        }
        catch (err)
        {}
        super.styleCell(td, row);
    }

    public getSortValue(row: TRow): any { return this.options.value(row); }
}

export interface IBarChartColumnOptions<TRow> extends IColumnOptions<TRow>
{
    ratio: (row: TRow)=>number;
    color: (ratio: number)=>string;
}

export class BarChartColumn<TRow> extends ColumnBase<TRow>
{
    constructor(private options: IBarChartColumnOptions<TRow>)
    {
        super(options);
    }

    public styleCell(td: HTMLTableCellElement, row: TRow)
    {
        try
        {
            var ratio = this.options.ratio(row);

            var bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.width = (100* ratio) + '%';
            bar.style.backgroundColor = this.options.color(ratio);
            td.appendChild(bar);
        }
        catch (err)
        {}

        super.styleCell(td, row);
    }

    public getSortValue(row: TRow): any { return this.options.ratio(row); }
}

export enum ActionPresentationType
{
    Hyperlink,
    Button
}

export interface IActionColumnOptions<TRow> extends IColumnOptions<TRow>
{
    text: string;
    action: (row: TRow)=>void;
    type?: ActionPresentationType;
    /** Indicates whether this column may be sorted. Defaults to false. */
    isSortable?: boolean;
}

export class ActionColumn<TRow> extends ColumnBase<TRow>
{
    constructor(private options: IActionColumnOptions<TRow>)
    {
        super(options);

        this.isSortable = !!options.isSortable;
    }

    public styleCell(td: HTMLTableCellElement, row: TRow)
    {
        td.classList.add('action');

        if (this.options.type === ActionPresentationType.Button)
        {
            var button = document.createElement('button');
            button.className = 'action';
            button.textContent = this.options.text;
            button.addEventListener('click', e => { e.preventDefault(); this.options.action(row); });
            td.classList.add('button');
            td.appendChild(button);
        }
        else
        {
            var a = document.createElement('a');
            a.className = 'action';
            a.href = '#';
            a.textContent = this.options.text;
            a.addEventListener('click', e => { e.preventDefault(); this.options.action(row); });
            td.classList.add('link');
            td.appendChild(a);
        }

        super.styleCell(td, row);
    }

    public styleHeader(th: HTMLTableHeaderCellElement)
    {
        th.classList.add('action');
        th.classList.add(this.options.type === ActionPresentationType.Button ? 'button' : 'link');
        if (this.options.className)
            th.classList.add(this.options.className);
    }
}

export interface IGridOptions<TRow>
{
    columns: IColumn<TRow>[];
    rowClassName?: (rowData: TRow) => string;
}

interface IRowModel<TRow>
{
    row: TRow;
    tr: HTMLTableRowElement;
}

export class Event<T>
{
    private callbacks: {(item:T):void}[] = [];

    public subscribe(callback: (item: T)=>void): ()=>void
    {
        this.callbacks.push(callback);

        return () =>
        {
            var index = this.callbacks.indexOf(callback);
            if (index === -1)
                console.warn("Attempt to unsubscribe unknown subscriber");
            else
                this.callbacks.splice(index, 1);
        };
    }

    public raise(item: T)
    {
        for (var i = 0; i < this.callbacks.length; i++)
            this.callbacks[i](item);
    }

    public getSubscriberCount() { return this.callbacks.length; }

    public collect(handler: (args:T[])=>void)
    {
        var args: T[] = [];
        var cancelSubscription = this.subscribe(a => args.push(a));
        handler(args);
        cancelSubscription();
    }
}

export function clearChildren(el: Element)
{
    while (el.hasChildNodes()) {
        el.removeChild(el.lastChild);
    }
}

export enum SortDirection
{
    Ascending,
    Descending
}

export interface INotifyChange<T>
{
    subscribeChange(callback: (item:T)=>void): ()=>void;
    notifyChange(): void;
}

class NotifyChange
{
    private callbacks: {(item:any):void}[];

    public subscribeChange(callback: (item:any)=>void): ()=>void
    {
        if (!this.callbacks)
            this.callbacks = [];
        this.callbacks.push(callback);
        return () =>
        {
            var index = this.callbacks.indexOf(callback);
            if (index === -1)
                console.warn("Attempt to unsubscribe unknown subscriber");
            else
                this.callbacks.splice(index, 1);
        };
    }

    public notifyChange(): void
    {
        if (this.callbacks)
        {
            for (var i = 0; i < this.callbacks.length; i++)
                this.callbacks[i](this);
        }
    }
}

var notifyChangePrototype = Object.create(NotifyChange.prototype);

export function mixinNotifyChange(obj: any)
{
    obj.__proto__ = notifyChangePrototype;
}

export enum CollectionChangeType
{
    /** An item is to be inserted at the specified position. */
    Insert = 0,
    /** An item's value has changed, and it should be updated in place. Neither position nor ID change. */
    Update = 1,
    /** An item is to be removed at the specified position. */
    Remove = 2,
    /** An item is to be moved to a new position. It should also be refreshed as its value has changed. */
    Move = 3,
    /** Considerable changes to the collection have occurred and clients should rebuild their views. */
    Reset = 4,
    /** An item in the collection is being replaced with another. ID changes and position may as well. */
    Replace = 5,
    /** The collection has changed outside the viewable window in a way that effects scroll position. */
    Scroll = 6
}

export class CollectionChange<T>
{
    public type: CollectionChangeType;
    public item: T;
    public itemId: string;
    public newIndex: number;
    public oldItem: T;
    public oldItemId: string;
    public oldIndex: number;
    public isNewlyAdded: boolean;

    public static insert<U>(item: U, itemId: string, index: number, isNewlyAdded: boolean): CollectionChange<U>
    {
        var chg = new CollectionChange<U>();
        chg.type = CollectionChangeType.Insert;
        chg.item = item;
        chg.itemId = itemId;
        chg.newIndex = index;
        chg.oldIndex = -1;
        chg.isNewlyAdded = isNewlyAdded;
        return chg;
    }

    public static remove<U>(item: U, itemId: string, index: number): CollectionChange<U>
    {
        var chg = new CollectionChange<U>();
        chg.type = CollectionChangeType.Remove;
        chg.item = item;
        chg.itemId = itemId;
        chg.newIndex = -1;
        chg.oldIndex = index;
        return chg;
    }

    public static replace<U>(oldItem: U, oldItemId: string, oldIndex: number, newItem: U, newItemId: string, newIndex: number, isNewlyAdded: boolean): CollectionChange<U>
    {
        var chg = new CollectionChange<U>();
        chg.type = CollectionChangeType.Replace;
        chg.item = newItem;
        chg.itemId = newItemId;
        chg.newIndex = newIndex;
        chg.oldItem = oldItem;
        chg.oldItemId = oldItemId;
        chg.oldIndex = oldIndex;
        return chg;
    }

    public static update<U>(item: U, itemId: string, index: number): CollectionChange<U>
    {
        var chg = new CollectionChange<U>();
        chg.type = CollectionChangeType.Update;
        chg.item = item;
        chg.itemId = itemId;
        chg.newIndex = index;
        chg.oldIndex = -1;
        return chg;
    }

    public static move<U>(item: U, itemId: string, oldIndex: number, newIndex: number): CollectionChange<U>
    {
        var chg = new CollectionChange<U>();
        chg.type = CollectionChangeType.Move;
        chg.item = item;
        chg.itemId = itemId;
        chg.oldIndex = oldIndex;
        chg.newIndex = newIndex;
        return chg;
    }

    public static reset<U>() : CollectionChange<U>
    {
        var chg = new CollectionChange<U>();
        chg.type = CollectionChangeType.Reset;
        chg.item = null;
        chg.itemId = null;
        chg.newIndex = -1;
        chg.oldIndex = -1;
        return chg;
    }

    public static scroll<U>() : CollectionChange<U>
    {
        var chg = new CollectionChange<U>();
        chg.type = CollectionChangeType.Scroll;
        chg.item = null;
        chg.itemId = null;
        chg.newIndex = -1;
        chg.oldIndex = -1;
        return chg;
    }
}

export interface IObservableCollection<T>
{
    changed: Event<CollectionChange<T>>;
}

export interface IDataSource<T> extends IObservableCollection<T>
{
    getAllItems(): T[];
    getItemId(item: T): string;
}

/**
 * A basic, observable, append-only data source.
 */
export class DataSource<T> implements IDataSource<T>
{
    public changed: Event<CollectionChange<T>> = new Event<CollectionChange<T>>();

    private items: T[] = [];
    private itemById: {[id: string]: T} = {};

    constructor(itemIdAccessor: (item: T)=>string, items?: T[])
    {
        this.getItemId = itemIdAccessor.bind(this);

        for (var i = 0; items && i < items.length; i++) {
            this.add(items[i]);
        }
    }

    public add(item: T)
    {
        var itemId = this.getItemId(item);

        if (!!this.itemById[itemId])
            throw new Error("Attempting to add item with ID '" + itemId + "', but that ID already exists.");

        this.subscribeItemUpdates(item);

        // Append new item
        this.items.push(item);
        this.changed.raise(CollectionChange.insert(item, itemId, this.items.length - 1, true));
        this.itemById[itemId] = item;
    }

    public addRange(items: T[])
    {
        for (var i = 0; i < items.length; i++)
        {
            var item = items[i];
            var itemId = this.getItemId(item);

            if (!!this.itemById[itemId])
                throw new Error("Attempting to add item with ID '" + itemId + "', but that ID already exists.");

            this.subscribeItemUpdates(item);

            // Append new item
            this.items.push(item);
            this.itemById[itemId] = item;
        }

        // TODO should we always reset? what if only one item is added? what's a good heuristic here?
        this.changed.raise(CollectionChange.reset<T>());
        this.changed.raise(CollectionChange.scroll<T>());
    }

    private subscribeItemUpdates(item: T)
    {
        var itemId = this.getItemId(item);
        var notifyItem: INotifyChange<T> = <any>item;
        if (notifyItem.subscribeChange && typeof(notifyItem.subscribeChange) === 'function') {
            notifyItem.subscribeChange(changedItem => {
                // TODO is this O(N) scan a problem?
                var index = this.items.indexOf(changedItem);
                this.changed.raise(CollectionChange.update(changedItem, itemId, index));
            });
        }
    }

    public removeAt(index: number)
    {
        var removed = this.items.splice(index, 1)[0];
        var itemId = this.getItemId(removed);
        delete this.itemById[itemId];
        this.changed.raise(CollectionChange.remove(removed, this.getItemId(removed), index));
    }

    public move(oldIndex: number, newIndex: number)
    {
        console.assert(oldIndex >= 0);
        console.assert(newIndex >= 0);
        var item = this.items.splice(oldIndex, 1)[0];
        this.items.splice(newIndex, 0, item);
        this.changed.raise(CollectionChange.move(item, this.getItemId(item), oldIndex, newIndex));
    }

    public get(index: number)
    {
        return this.items[index];
    }

    public getAllItems(): T[]
    {
        return this.items;
    }

    public getById(id: string): T
    {
        return this.itemById[id];
    }

    public getItemId(item: T): string
    {
        throw new Error("Should be rebound in constructor.");
    }

    public reset()
    {
        this.changed.raise(CollectionChange.reset<T>());
    }

    public clear()
    {
        this.items = [];
        this.itemById = {};
        this.reset();
    }
}

export class FilterView<T> implements IDataSource<T>
{
    public changed: Event<CollectionChange<T>> = new Event<CollectionChange<T>>();

    private items: T[] = [];
    private itemFilterState: {[itemId: string]:boolean} = {};
    private predicate: (item: T)=>boolean;

    constructor(private source: IDataSource<T>,
                predicate?: (item: T)=>boolean)
    {
        this.getItemId = source.getItemId;
        source.changed.subscribe(this.onSourceChanged.bind(this));

        this.setPredicate(predicate);
    }

    private onSourceChanged(event: CollectionChange<T>)
    {
        var passesFilter = event.item && (!this.predicate || this.predicate(event.item));

        switch (event.type)
        {
            case CollectionChangeType.Insert:
            {
                console.assert(typeof(this.itemFilterState[event.itemId]) === 'undefined');
                this.itemFilterState[event.itemId] = passesFilter;
                if (passesFilter)
                    this.append(event.item, event.itemId, event.isNewlyAdded);
                break;
            }
            case CollectionChangeType.Remove:
            {
                if (!passesFilter)
                    return;
                delete this.itemFilterState[event.itemId];
                this.remove(event.item, event.itemId);
                break;
            }
            case CollectionChangeType.Update:
            {
                var priorState = this.itemFilterState[event.itemId];
                console.assert(typeof(priorState) !== 'undefined');
                if (priorState === passesFilter)
                {
                    if (priorState)
                    {
                        // TODO this is an O(N) scan -- do consumers of the event even need index here?
                        var index = this.items.indexOf(event.item);
                        console.assert(index !== -1);
                        this.changed.raise(CollectionChange.update(event.item, event.itemId, index));
                    }
                    return;
                }
                this.itemFilterState[event.itemId] = passesFilter;

                if (!priorState) {
                    // Newly passes the filter -- add
                    this.append(event.item, event.itemId, false);
                } else {
                    // Newly fails the filter -- remove
                    this.remove(event.item, event.itemId);
                }
                break;
            }
            case CollectionChangeType.Move:
            {
                console.error("Move not supported");
                break;
            }
            case CollectionChangeType.Reset:
            {
                this.items = [];
                this.itemFilterState = {};
                var sourceItems = this.source.getAllItems();
                if (this.predicate)
                {
                    for (var i = 0; i < sourceItems.length; i++)
                    {
                        var item = sourceItems[i];
                        var matches = this.predicate(item);
                        this.itemFilterState[this.getItemId(item)] = matches;
                        if (matches)
                            this.items.push(item);
                    }
                }
                else
                {
                    this.items = this.items.concat(sourceItems);
                    for (var i = 0; i < sourceItems.length; i++)
                        this.itemFilterState[this.getItemId(sourceItems[i])] = true;
                }
                this.changed.raise(event);
                break;
            }
            case CollectionChangeType.Scroll:
            {
                this.changed.raise(event);
                break;
            }
        }
    }

    public setPredicate(predicate: (item: T)=>boolean)
    {
        this.predicate = predicate;

        var items = this.source.getAllItems(),
            filteredItems: T[] = [],
            hasChange = false;

        for (var i = 0; i < items.length; i++)
        {
            var item = items[i],
                itemId = this.source.getItemId(item),
                passesFilter = !predicate || predicate(item),
                priorState = this.itemFilterState[itemId];

            if (priorState !== passesFilter)
            {
                this.itemFilterState[itemId] = passesFilter;
                hasChange = true;
            }

            if (passesFilter)
                filteredItems.push(item);
        }

        if (hasChange)
        {
            this.items = filteredItems;
            this.changed.raise(CollectionChange.reset<T>());
            this.changed.raise(CollectionChange.scroll<T>());
        }
    }

    private append(item: T, itemId: string, isNewlyAdded: boolean): void
    {
        this.items.push(item);
        this.changed.raise(CollectionChange.insert(item, itemId, this.items.length - 1, isNewlyAdded));
    }

    private remove(item: T, itemId: string): void
    {
        // TODO O(N) scan -- does any consumer of this event actually use the index?
        var index = this.items.indexOf(item);
        console.assert(index !== -1);
        this.items.splice(index, 1);
        this.changed.raise(CollectionChange.remove(item, itemId, index));
    }

    public getAllItems(): T[]
    {
        return this.items;
    }

    public getItemId(item: T): string
    {
        throw new Error("Should be replaced in constructor");
    }
}

/// compare: 0 (equal), -1 (a < b), 1 (a > b)

export function findInsertionIndex<T>(items: T[], target: T, comparator: (a:T, b:T)=>number)
{
    if (items.length === 0)
        return 0;

    var minIndex = 0,
        maxIndex = items.length - 1;

    while (minIndex < maxIndex)
    {
        var index = (minIndex + maxIndex) / 2 | 0;
        var item = items[index];

        if (item === target)
        {
            if (index === 0)
                return minIndex;
            if (index === items.length - 1)
                return items.length - 1;

            var orderedBelow = comparator(items[index - 1], target) < 0,
                orderedAbove = comparator(target, items[index + 1]) < 0;

            if (orderedBelow === orderedAbove)
            {
                // The target is already correctly ordered
                return index;
            }

            if (orderedBelow)
                minIndex = index + 1;
            else
                maxIndex = index - 1;

            continue;
        }

        var comp = comparator(target, item);

        if (comp === 0)
            return index;

        if (comp > 0)
            minIndex = index + 1;
        else
            maxIndex = index;
    }

    if (minIndex === items.length - 1 && comparator(items[items.length - 1], target) < 0)
        return items.length;

    return minIndex;
}

var compare = (a: any, b: any, sortDir: SortDirection) => a === b
    ? 0
    : a === undefined
        ? 1
        : b === undefined
            ? -1
            : a < b
                ? sortDir === SortDirection.Ascending ? -1 : 1
                : sortDir === SortDirection.Ascending ? 1 : -1;

export class SortView<T> implements IDataSource<T>
{
    public changed: Event<CollectionChange<T>> = new Event<CollectionChange<T>>();

    private items: T[];
    private sortColumn: IColumn<T>;
    private sortDirection: SortDirection = SortDirection.Ascending;

    constructor(private source: IDataSource<T>)
    {
        this.getItemId = source.getItemId;
        this.items = source.getAllItems().slice(0); // slice in this form clones the array

        source.changed.subscribe(this.onSourceChanged.bind(this));

        this.setSortColumn(null);
    }

    public validateSortOrder()
    {
        if (!this.sortColumn)
            return false;

        var items = this.getAllItems();

        for (var i = 1; i < items.length; i++)
        {
            var a = items[i - 1],
                b = items[i];

            if (this.sortDirection === SortDirection.Ascending)
                console.assert(this.sortColumn.getSortValue(a) <= this.sortColumn.getSortValue(b));
            else
                console.assert(this.sortColumn.getSortValue(a) >= this.sortColumn.getSortValue(b));
        }
    }

    public getSortDirection() { return this.sortDirection; }

    public setSortColumn(column: IColumn<T>)
    {
        if (column == null)
        {
            this.sortColumn = null;
            this.sortDirection = SortDirection.Ascending;
            return;
        }

        // Toggle direction on multiple clicks
        if (this.sortColumn === column)
            this.sortDirection = this.sortDirection === SortDirection.Ascending ? SortDirection.Descending : SortDirection.Ascending;
        else
            this.sortDirection = column.getDefaultSortDirection();
        this.sortColumn = column;

        this.reset();
    }

    private reset()
    {
        if (this.sortColumn)
        {
            this.items.sort((a, b) =>
            {
                var v1 = this.sortColumn.getSortValue(a);
                var v2 = this.sortColumn.getSortValue(b);
                return compare(v1, v2, this.sortDirection);
            });
        }

        this.changed.raise(CollectionChange.reset<T>());
    }

    private onSourceChanged(event: CollectionChange<T>)
    {
        switch (event.type)
        {
            case CollectionChangeType.Insert:
            {
                var insertIndex = this.sortColumn
                    ? findInsertionIndex(this.items, event.item, (a, b) => compare(this.sortColumn.getSortValue(a), this.sortColumn.getSortValue(b), this.sortDirection))
                    : this.items.length;
                this.items.splice(insertIndex, 0, event.item);
                this.changed.raise(CollectionChange.insert<T>(event.item, event.itemId, insertIndex, event.isNewlyAdded));
                break;
            }
            case CollectionChangeType.Remove:
            {
                var index = this.items.indexOf(event.item);
                this.items.splice(index, 1);
                this.changed.raise(CollectionChange.remove<T>(event.item, event.itemId, index));
                break;
            }
            case CollectionChangeType.Update:
            {
                var oldIndex = this.items.indexOf(event.item);
                console.assert(oldIndex !== -1, "Updated item should be in items array");
                var newIndex = this.sortColumn
                    ? findInsertionIndex(this.items, event.item, (a, b) => compare(this.sortColumn.getSortValue(a), this.sortColumn.getSortValue(b), this.sortDirection))
                    : oldIndex;

                console.assert(newIndex >= 0);
                console.assert(newIndex <= this.items.length);

                var adjustedNewIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;

                if (oldIndex === adjustedNewIndex)
                {
                    // short circuit if the update doesn't actually change the sort order for this row
                    this.changed.raise(CollectionChange.update<T>(event.item, event.itemId, oldIndex));
                }
                else
                {
                    // Remove value from current position
                    var removed = this.items.splice(oldIndex, 1);
                    console.assert(removed[0] === event.item);
                    this.items.splice(adjustedNewIndex, 0, event.item);
                    this.changed.raise(CollectionChange.move<T>(event.item, event.itemId, oldIndex, adjustedNewIndex));
                }
                break;
            }
            case CollectionChangeType.Move:
            {
                console.error("Move not supported");
                break;
            }
            case CollectionChangeType.Reset:
            {
                this.items = [].concat(this.source.getAllItems());
                this.reset();
                break;
            }
            case CollectionChangeType.Scroll:
            {
                this.changed.raise(event);
                break;
            }
        }
    }

    public getAllItems(): T[]
    {
        return this.items;
    }

    public getItemId(item: T): string
    {
        throw new Error("Should be replaced in constructor");
    }
}

export class WindowView<T> implements IDataSource<T>
{
    public changed: Event<CollectionChange<T>> = new Event<CollectionChange<T>>();

    private windowSize: number;
    private offset: number;

    constructor(private source: IDataSource<T>, windowSize: number)
    {
        this.getItemId = source.getItemId;
        this.offset = 0;

        source.changed.subscribe(this.onSourceChanged.bind(this));
        this.setWindowSize(windowSize);
    }

    public getWindowSize() { return this.windowSize; }
    public getWindowOffset() { return this.offset; }

    public getUnderlyingItemCount() { return this.source.getAllItems().length; }

    private toWindowIndex(index: number)
    {
        return index - this.offset;
    }

    private onSourceChanged(event: CollectionChange<T>)
    {
        switch (event.type)
        {
            case CollectionChangeType.Insert:
            {
                var windowIndex = this.toWindowIndex(event.newIndex);
                if (this.isValidWindowIndex(windowIndex))
                    this.insert(event.item, event.itemId, windowIndex, event.isNewlyAdded);
                else
                    this.changed.raise(CollectionChange.scroll<T>());
                break;
            }
            case CollectionChangeType.Remove:
            {
                var windowIndex = this.toWindowIndex(event.oldIndex);
                if (this.isValidWindowIndex(windowIndex))
                    this.remove(event.item, event.itemId, windowIndex);
                else
                {
                    if (windowIndex < 0)
                        this.offset--;
                    this.changed.raise(CollectionChange.scroll<T>());
                }
                break;
            }
            case CollectionChangeType.Update:
            {
                var index = this.toWindowIndex(event.newIndex);
                if (this.isValidWindowIndex(index))
                    this.changed.raise(CollectionChange.update(event.item, event.itemId, event.newIndex - this.offset));
                break;
            }
            case CollectionChangeType.Move:
            {
                var oldWIndex = this.toWindowIndex(event.oldIndex);
                var newWIndex = this.toWindowIndex(event.newIndex);

                var wasBefore = oldWIndex < 0,
                    isBefore = newWIndex < 0,
                    wasAfter = oldWIndex >= this.windowSize,
                    isAfter = newWIndex >= this.windowSize,
                    wasIn = !wasBefore && !wasAfter,
                    isIn = !isBefore && !isAfter;

                if ((wasBefore && isBefore) || (wasAfter && isAfter))
                    break;

                if (wasIn && isIn)
                {
                    // Move within the window
                    this.changed.raise(CollectionChange.move(event.item, event.itemId, oldWIndex, newWIndex));
                    break;
                }

                var removeItem: T,
                    insertItem: T,
                    removeIndex: number,
                    insertIndex: number,
                    sourceItems = this.source.getAllItems();

                if (wasBefore && isAfter)
                {
                    // before -> after -- pull everything up one
                    removeItem = sourceItems[this.offset - 1];
                    insertItem = sourceItems[this.offset + this.windowSize - 1];
                    removeIndex = 0;
                    insertIndex = this.windowSize - 1;
                }
                else if (wasAfter && isBefore)
                {
                    // after -> before -- push everything down one
                    removeItem = sourceItems[this.offset + this.windowSize];
                    insertItem = sourceItems[this.offset];
                    removeIndex = this.windowSize - 1;
                    insertIndex = 0;
                }
                else if (wasIn)
                {
                    // inside -> outside
                    removeItem = sourceItems[event.newIndex];
                    removeIndex = oldWIndex;
                    if (isBefore)
                    {
                        // inside -> before
                        insertItem = sourceItems[this.offset];
                        insertIndex = 0;
                    }
                    else
                    {
                        // inside -> after
                        insertItem = sourceItems[this.offset + this.windowSize - 1];
                        insertIndex = this.windowSize - 1;
                    }
                }
                else
                {
                    // outside -> inside
                    insertItem = sourceItems[event.newIndex];
                    insertIndex = newWIndex;
                    if (wasBefore)
                    {
                        // before -> inside
                        removeItem = sourceItems[this.offset - 1];
                        removeIndex = 0;
                    }
                    else
                    {
                        // after -> inside
                        removeItem = sourceItems[this.offset + this.windowSize];
                        removeIndex = this.windowSize - 1;
                    }
                }

                this.changed.raise(CollectionChange.replace(
                    removeItem, this.source.getItemId(removeItem), removeIndex,
                    insertItem, this.source.getItemId(insertItem), insertIndex, false));

                break;
            }
            case CollectionChangeType.Reset:
            {
                this.changed.raise(event);
                break;
            }
            case CollectionChangeType.Scroll:
            {
                this.changed.raise(event);
                break;
            }
        }
    }

    private remove(item: T, itemId: string, windowIndex: number)
    {
        var sourceItems = this.source.getAllItems();

        // If enough items exist after the window, slurp one in
        if (this.offset + this.windowSize <= sourceItems.length)
        {
            var appendItem = sourceItems[this.offset + this.windowSize - 1];
            this.changed.raise(CollectionChange.replace(
                item, itemId, windowIndex,
                appendItem, this.getItemId(appendItem), this.windowSize - 1, false));
        }
        else
        {
            this.changed.raise(CollectionChange.remove(item, itemId, windowIndex));
        }
        this.changed.raise(CollectionChange.scroll<T>());
    }

    private insert(item: T, itemId: string, windowIndex: number, isNewlyAdded: boolean)
    {
        var sourceItems = this.source.getAllItems();

        // If we have too many items, remove one from the end
        if (this.offset + this.windowSize < sourceItems.length)
        {
            var removeItem = sourceItems[this.offset + this.windowSize];
            this.changed.raise(CollectionChange.replace(
                removeItem, this.getItemId(removeItem), this.windowSize - 1,
                item, itemId, windowIndex, isNewlyAdded));
        }
        else
        {
            this.changed.raise(CollectionChange.insert(item, itemId, windowIndex, isNewlyAdded));
        }
        this.changed.raise(CollectionChange.scroll<T>());
    }

    private isValidWindowIndex(windowIndex: number)
    {
        return windowIndex >= 0 && windowIndex < this.windowSize;
    }

    public setWindowOffset(offset: number)
    {
        // Truncate to integer
        offset |= 0;

        if (this.offset === offset)
            return;
        if (offset < 0)
            throw new Error("Window offset cannot be negative.");

        var oldOffset = this.offset;
        this.offset = offset;

        var diff = offset - oldOffset;
        var items = this.source.getAllItems();

        if (Math.abs(diff) >= this.windowSize / 2)
        {
            // Enough has changed that it's less work for clients to just reset
            this.changed.raise(CollectionChange.reset<T>());
            this.changed.raise(CollectionChange.scroll<T>());
        }
        else if (diff > 0)
        {
            // Scrolling 'down'.
            for (var i = 0; i < diff; i++)
            {
                // Remove from top and introduce at bottom (if available)
                var removeIndex = oldOffset + i,
                    insertIndex = oldOffset + this.windowSize + i,
                    validRemove = removeIndex >= 0 && removeIndex < items.length,
                    validInsert = insertIndex >= 0 && insertIndex < items.length;

                console.assert(validRemove || !validInsert);

                if (validRemove)
                {
                    var removeItem = items[removeIndex],
                        insertItem = items[insertIndex];

                    if (validInsert)
                    {
                        this.changed.raise(CollectionChange.replace(
                            removeItem, this.getItemId(removeItem), 0,
                            insertItem, this.getItemId(insertItem), this.windowSize - 1, false));
                    }
                    else
                    {
                        this.changed.raise(CollectionChange.remove(removeItem, this.getItemId(removeItem), 0));
                    }
                }
            }
            this.changed.raise(CollectionChange.scroll<T>());
        }
        else
        {
            // Scrolling 'up'.
            diff = -diff;

            for (var i = diff - 1; i >= 0; i--)
            {
                // Remove from bottom and introduce at top
                var removeIndex = this.offset + this.windowSize + i,
                    insertIndex = this.offset + i,
                    validRemove = removeIndex >= 0 && removeIndex < items.length,
                    validInsert = insertIndex >= 0 && insertIndex < items.length;

                console.assert(!validRemove || validInsert);

                if (validInsert)
                {
                    var removeItem = items[removeIndex],
                        insertItem = items[insertIndex];

                    if (validRemove)
                    {
                        this.changed.raise(CollectionChange.replace(
                            removeItem, this.getItemId(removeItem), this.windowSize - 1,
                            insertItem, this.getItemId(insertItem), 0, false));
                    }
                    else
                    {
                        this.changed.raise(CollectionChange.insert(insertItem, this.getItemId(insertItem), 0, false));
                    }
                }
            }
            this.changed.raise(CollectionChange.scroll<T>());
        }
    }

    public setWindowSize(size: number)
    {
        if (this.windowSize === size)
            return;
        if (size < 0)
            throw new Error("Window size cannot be negative.");

        var oldSize = this.windowSize;
        this.windowSize = size;

        var items = this.source.getAllItems();

        if (oldSize < size)
        {
            for (var i = oldSize; i < size; i++)
            {
                var sourceIndex = i + this.offset;
                if (sourceIndex < 0 || sourceIndex >= items.length)
                    continue;
                var item = items[sourceIndex];
                this.changed.raise(CollectionChange.insert(item, this.getItemId(item), i, false));
            }
            this.changed.raise(CollectionChange.scroll<T>());
        }
        else
        {
            for (var i = oldSize - 1; i >= size; i--)
            {
                var sourceIndex = i + this.offset;
                if (sourceIndex < 0 || sourceIndex >= items.length)
                    continue;
                var item = items[sourceIndex];
                this.changed.raise(CollectionChange.remove(item, this.getItemId(item), i));
            }
            this.changed.raise(CollectionChange.scroll<T>());
        }
    }

    public getAllItems(): T[]
    {
        return this.source.getAllItems().slice(this.offset, this.offset + this.windowSize);
    }

    public getItemId(item: T): string
    {
        throw new Error("Should be replaced in constructor");
    }
}

export class Grid<TRow>
{
    private thead: HTMLTableSectionElement;
    private tbody: HTMLTableSectionElement;
    private headerRow: HTMLTableRowElement;
    private filterRow: HTMLTableRowElement;
    private rowModelById: {[s:string]: IRowModel<TRow> };
    private filterSource: FilterView<TRow>;
    private sortSource: SortView<TRow>;
    private windowSource: WindowView<TRow>;
    private source: IDataSource<TRow>;

    private scrollColumnHeader: HTMLTableHeaderCellElement;
    private scrollCell: HTMLTableCellElement;
    private scrollOuter: HTMLDivElement;
    private scrollInner: HTMLDivElement;

    public enableRowHighlighting: boolean = true;

    private static ScrollRowCount = 1;

    constructor(source: IDataSource<TRow>, public table: HTMLTableElement, public options: IGridOptions<TRow>)
    {
        //
        // Create table sections
        //

        this.thead = document.createElement('thead');
        this.tbody = document.createElement('tbody');

        this.table.classList.add('biggus');
        this.table.appendChild(this.thead);
        this.table.appendChild(this.tbody);

        //
        // Create header row
        //

        this.headerRow = document.createElement('tr');
        this.headerRow.className = 'header';
        this.thead.appendChild(this.headerRow);

        this.filterRow = document.createElement('tr');
        this.filterRow.className = 'filter';
        this.thead.appendChild(this.filterRow);

        var initialiseColumn = (column: IColumn<TRow>) =>
        {
            // Header row

            var th = document.createElement('th');

            column.styleHeader(th);

            if (column.isSortable)
            {
                th.classList.add('sortable');

                th.addEventListener('click', () =>
                {
                    // Clear any other sort hints
                    var headers = this.thead.querySelectorAll('th');
                    for (var i = 0; i < headers.length; i++)
                    {
                        var header = <HTMLTableHeaderCellElement>headers[i];
                        header.classList.remove('sort-ascending');
                        header.classList.remove('sort-descending');
                    }

                    this.sortSource.setSortColumn(column);

                    th.classList.add(this.sortSource.getSortDirection() === SortDirection.Ascending ? 'sort-descending' : 'sort-ascending');
                });
            }

            this.headerRow.appendChild(th);

            // Filter row

            var td = document.createElement('td');

            if (column.isFilterable)
            {
                var input = document.createElement('input');
                input.type = 'text';
                input.size = 1;
                td.appendChild(input);

                if ((<any>column).setFilterText)
                {
                    var textColumn = <TextColumn<TRow>>column;
                    input.addEventListener('input', _ =>
                    {
                        textColumn.setFilterText(input.value);
                    });
                }

                column.filterChanged.subscribe(this.updateFilter.bind(this));
            }

            this.filterRow.appendChild(td);
        };

        for (var c = 0; c < this.options.columns.length; c++)
            initialiseColumn(this.options.columns[c]);

        this.scrollColumnHeader = document.createElement('th');
        this.scrollColumnHeader.className = 'scroll';
        this.scrollCell = document.createElement('td');
        this.scrollCell.className = 'scroll';
        this.scrollOuter = document.createElement('div');
        this.scrollOuter.className = 'scroll-outer';
        this.scrollInner = document.createElement('div');
        this.scrollCell.appendChild(this.scrollOuter);
        this.scrollOuter.appendChild(this.scrollInner);
        var scrollRow = document.createElement('tr');
        scrollRow.className = 'scroll';
        var scrollVoidCell = document.createElement('td');
        scrollVoidCell.colSpan = this.options.columns.length;
        scrollRow.appendChild(scrollVoidCell);
        scrollRow.appendChild(this.scrollCell);
        this.tbody.appendChild(scrollRow);

        this.table.addEventListener('mousewheel', (e: MouseWheelEvent) =>
        {
            if (e.altKey || e.ctrlKey || e.shiftKey)
                return;

            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();

            var offset = this.windowSource.getWindowOffset();
            offset -= e.wheelDelta / 40;
            offset = Math.min(offset, this.sortSource.getAllItems().length - this.windowSource.getWindowSize());
            offset = Math.max(offset, 0);
            this.windowSource.setWindowOffset(offset);

            return false;
        });

        this.scrollOuter.addEventListener('scroll', e =>
        {
            var height = this.scrollInner.clientHeight;
            var scrollRatio = (this.scrollOuter.scrollTop / height);
            var offset = Math.round(scrollRatio * this.windowSource.getUnderlyingItemCount());
            this.windowSource.setWindowOffset(offset);
        });

        this.headerRow.appendChild(this.scrollColumnHeader);
        this.filterRow.appendChild(document.createElement('td'));

        // Set the tab index so that we receive key events on the table element
        this.table.tabIndex = 1;
        this.table.addEventListener('keydown', (e: KeyboardEvent) =>
        {
            // Don't process keyboard input intended for an input element
            if (e.target instanceof HTMLInputElement)
                return;

            var offsetBefore = this.windowSource.getWindowOffset(),
                newOffset = offsetBefore,
                maxOffset = Math.max(0, this.windowSource.getUnderlyingItemCount() - this.windowSource.getWindowSize());

            if (e.keyCode === 38) {
                // UP ARROW
                newOffset--;
            } else if (e.keyCode === 40) {
                // DOWN ARROW
                newOffset++
            } else if (e.keyCode === 36) {
                // HOME
                newOffset = 0;
            } else if (e.keyCode === 35) {
                // END
                newOffset = maxOffset;
            } else if (e.keyCode === 33) {
                // PAGE UP
                newOffset -= this.windowSource.getWindowSize();
            } else if (e.keyCode === 34) {
                // PAGE DOWN
                newOffset += this.windowSource.getWindowSize();
            }

            if (newOffset < 0)
                newOffset = 0;
            if (newOffset > maxOffset)
                newOffset = maxOffset;

            if (newOffset === offsetBefore)
                return;

            this.windowSource.setWindowOffset(newOffset);
            e.preventDefault();
        });

        this.filterSource = new FilterView(source, null);

        this.sortSource = new SortView(this.filterSource);

        this.windowSource = new WindowView(this.sortSource, 4);

        this.source = this.windowSource;
        this.source.changed.subscribe(this.onSourceChanged.bind(this));

        // TODO need a way of detaching this listener -- potential memory leak
        window.addEventListener('resize', e =>
        {
            this.updateScrollbar();
        });

        this.reset();
    }

    private updateScrollbar()
    {
        // TODO this function reads/writes a lot of DOM measurements, which slows down some usage patterns (clientHeight, scrollTop, ...)

        // Calculate the target number of rows
        var rowCount = this.windowSource.getAllItems().length;

        this.scrollCell.rowSpan = rowCount + Grid.ScrollRowCount;

        // The rest of this function requires the table to have a parent in order to know the
        // available space for layout. If no parent exists yet, return now.
        if (!this.table.parentElement)
            return;

        var bodyHeight = this.tbody.clientHeight,
            headHeight = this.thead.clientHeight,
            availableHeight = (this.table.parentElement.clientHeight - headHeight);

        var heightScale = this.windowSource.getUnderlyingItemCount() / rowCount;
        var height = bodyHeight * heightScale;
        this.scrollInner.style.height = height + 'px';

        var startRatio = this.windowSource.getWindowOffset() / this.windowSource.getUnderlyingItemCount();
        this.scrollOuter.scrollTop = height * startRatio;

        this.scrollOuter.style.height = availableHeight + 'px';

        var showScrollbar = this.windowSource.getWindowOffset() !== 0
            || this.windowSource.getWindowSize() < this.windowSource.getUnderlyingItemCount();

        if (showScrollbar) {
            this.scrollColumnHeader.style.width = '';
            this.scrollOuter.style.display = 'block';
        } else {
            this.scrollColumnHeader.style.width = '0px';
            this.scrollOuter.style.display = 'none';
        }

        var bodyRowCount = this.tbody.childElementCount - Grid.ScrollRowCount;
        if (bodyHeight > availableHeight)
        {
            // Remove extra rows
            var removeCount = 0;
            while (true)
            {
                var row = <HTMLTableRowElement>this.tbody.children[this.tbody.childElementCount - 1 - removeCount];
                if (!row || row.offsetTop - headHeight < availableHeight)
                    break;
                removeCount++;
            }

            if (removeCount !== 0)
            {
                var windowSize = this.windowSource.getWindowSize();
                this.windowSource.setWindowSize(Math.max(0, windowSize - removeCount));
            }
        }
        else if (bodyHeight < availableHeight)
        {
            // Add extra rows to fill space
            var avgRowHeight = bodyHeight === 0
                ? 20 // we don't have any existing rows to measure, so just assume a height of 20px -- it will adjust in the next pass
                : bodyHeight / bodyRowCount;

            console.assert(avgRowHeight !== 0 && !isNaN(avgRowHeight) && isFinite(avgRowHeight));
            this.windowSource.setWindowSize(Math.ceil(availableHeight / avgRowHeight));
        }
    }

    private reset()
    {
        this.rowModelById = {};

        var items = this.source.getAllItems(),
            rowCountBefore = this.tbody.childElementCount - Grid.ScrollRowCount,
            rowCountAfter = items.length;

        // Remove any extra, unneeded rows from the end
        for (var i = rowCountAfter; i < rowCountBefore; i++)
            this.tbody.removeChild(this.tbody.lastChild);

        var reuseCount = Math.min(rowCountBefore, rowCountAfter);

        this.scrollCell.rowSpan = reuseCount + Grid.ScrollRowCount;

        // Rebind any existing rows
        for (var i = 0; i < reuseCount; i++) {
            var model = { row: items[i], tr: <HTMLTableRowElement>this.tbody.children[i + Grid.ScrollRowCount] };
            this.rowModelById[this.source.getItemId(items[i])] = model;
            this.clearRow(model.tr);
            this.bindRow(model);
        }

        // Append any new rows
        for (var i = reuseCount; i < rowCountAfter; i++) {
            this.insertRow(items[i], this.source.getItemId(items[i]), i, false);
        }
    }

    private updateFilter()
    {
        var preds = [];
        for (var c = 0; c < this.options.columns.length; c++)
        {
            var column = this.options.columns[c];
            if (column.isFilterable && column.isFiltering)
                preds.push(column.filterPredicate);
        }
        if (preds.length)
        {
            this.filterSource.setPredicate(item =>
            {
                for (var i = 0; i < preds.length; i++)
                    if (!preds[i](item))
                        return false;
                return true;
            });
        }
        else
        {
            this.filterSource.setPredicate(null);
        }
    }

    private onSourceChanged(event: CollectionChange<TRow>): void
    {
        switch (event.type)
        {
            case CollectionChangeType.Insert:
            {
                this.insertRow(event.item, event.itemId, event.newIndex, event.isNewlyAdded);
                break;
            }
            case CollectionChangeType.Remove:
            {
                this.removeRow(event.item, event.itemId);
                break;
            }
            case CollectionChangeType.Move:
            {
                this.moveRow(event.oldIndex, event.newIndex);
                this.updateRow(event.itemId);
                break;
            }
            case CollectionChangeType.Update:
            {
                this.updateRow(event.itemId);
                break;
            }
            case CollectionChangeType.Replace:
            {
                console.assert(typeof(this.rowModelById[event.itemId]) === "undefined", "New row should NOT have a row model");
                this.replace(event.oldItemId, event.itemId, event.item, event.oldIndex, event.newIndex, event.isNewlyAdded);
                break;
            }
            case CollectionChangeType.Reset:
            {
                this.reset();
                break;
            }
            case CollectionChangeType.Scroll:
            {
                this.updateScrollbar();
                break;
            }
        }
    }

    private replace(oldItemId: string, newItemId: string, newItem: TRow, oldIndex: number, newIndex: number, isNewlyAdded: boolean)
    {
        var oldRowModel = this.rowModelById[oldItemId];
        console.assert(typeof(oldRowModel) !== "undefined", "Old row should have a row model");
        this.clearRow(oldRowModel.tr);
        delete this.rowModelById[oldItemId];
        var newRowModel = {tr: oldRowModel.tr, row: newItem};
        this.rowModelById[newItemId] = newRowModel;
        this.bindRow(newRowModel);
        this.insertRowAt(oldIndex < newIndex ? newIndex + 1 : newIndex, newRowModel.tr);
        if (isNewlyAdded)
            this.flashRow(newRowModel.tr);
    }

    private removeRow(item: TRow, itemId: string)
    {
        console.assert(typeof(this.rowModelById[itemId]) !== 'undefined', "Removed row should have a row model");
        var rowModel = this.rowModelById[itemId];

        this.tbody.removeChild(rowModel.tr);
        this.scrollCell.rowSpan--;
        delete this.rowModelById[itemId];
    }

    private insertRow(item: TRow, itemId: string, index: number, flash: boolean)
    {
        console.assert(index >= 0);
        console.assert(typeof(this.rowModelById[itemId]) === 'undefined', "Inserted row should not have a row model");
        var tr = this.createRow();
        var rowModel = {row: item, tr: tr};
        this.rowModelById[itemId] = rowModel;
        this.bindRow(rowModel);
        this.insertRowAt(index, tr);
        this.scrollCell.rowSpan++;

        if (flash)
            this.flashRow(tr);
    }

    private insertRowAt(index: number, tr: HTMLTableRowElement)
    {
        // We need to take the scrollbar row into account here
        if (index === this.tbody.childElementCount - Grid.ScrollRowCount)
            this.tbody.appendChild(tr);
        else
            this.tbody.insertBefore(tr, this.tbody.children[index + Grid.ScrollRowCount]);
    }

    private updateRow(itemId: string)
    {
        var rowModel = this.rowModelById[itemId];
        console.assert(typeof(rowModel) !== "undefined", "Updated row should have a row model");
        this.clearRow(rowModel.tr);
        this.bindRow(rowModel);
        this.flashRow(rowModel.tr);
    }

    private moveRow(oldIndex: number, newIndex: number)
    {
        console.assert(oldIndex !== newIndex);

        // Add one to skip over the scroll row
        var tr = <HTMLTableRowElement>this.tbody.children[oldIndex + Grid.ScrollRowCount];

        if (newIndex === this.tbody.childElementCount + Grid.ScrollRowCount)
        {
            this.tbody.appendChild(tr);
        }
        else
        {
            var adjustedNewIndex = oldIndex < newIndex ? newIndex + 1 : newIndex;
            this.tbody.insertBefore(tr, this.tbody.children[adjustedNewIndex + Grid.ScrollRowCount]);
        }
    }

    private flashRow(tr: HTMLTableRowElement)
    {
        if (!this.enableRowHighlighting)
            return;

        // Flash the row that changed
        // TODO only queue this timer if the row is visible (once we model this)
        tr.classList.add('highlight-delta');
        setTimeout(() =>
        {
            tr.classList.remove('highlight-delta');
        }, 100);
    }

    /** Create a new tr element with the correct number of td children. */
    private createRow(): HTMLTableRowElement
    {
        var tr = document.createElement('tr');
        for (var c = 0; c < this.options.columns.length; c++)
            tr.appendChild(document.createElement('td'))
        return tr;
    }

    /** Populate the tr/td elements from the row. */
    private bindRow(rowModel: IRowModel<TRow>): void
    {
        for (var c = 0; c < this.options.columns.length; c++)
        {
            var column = this.options.columns[c];
            var td = <HTMLTableCellElement>rowModel.tr.children[c];

            column.styleCell(td, rowModel.row);
        }

        if (this.options.rowClassName)
            rowModel.tr.className = this.options.rowClassName(rowModel.row);
    }

    /** Clears all state from a tr element and all child td elements. */
    private clearRow(tr: HTMLTableRowElement): void
    {
        tr.removeAttribute('class');

        for (var c = 0; c < this.options.columns.length; c++)
        {
            var td = <HTMLTableCellElement>tr.children[c];
            td.removeAttribute("class");
            td.textContent = null;
            while (td.firstChild) {
                td.removeChild(td.firstChild);
            }
        }
    }
}
