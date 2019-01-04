import { ThingworxRuntimeWidget, TWService, TWProperty } from 'typescriptwebpacksupport'

interface Rule {
    id: string,
    field: string,
    type: string,
    input: string,
    operator: string,
    value: any
}

interface RuleGroup {
    condition: 'AND' | 'OR',
    rules: (Rule | RuleGroup)[],
    valid: boolean
}

function isRuleGroup(obj: Rule | RuleGroup): obj is RuleGroup {
    return 'condition' in obj;
}

const ThingworxTypeMap = {
    equal: 'EQ',
    contains: 'LIKE',
    begins_with: 'LIKE',
    ends_with: 'LIKE',
    not_equal: 'NE',
    greater: 'GT',
    greater_or_equal: 'GE',
    between: 'BETWEEN',
    not_between: 'NOTBETWEEN',
    less: 'LT',
    less_or_equal: 'LE',
    true: 'EQ',
    false: 'EQ'
};

declare function moment(...args: any[]): any;


@ThingworxRuntimeWidget
class QueryBuilder extends TWRuntimeWidget {

    /**
     * The data shape.
     */
    dataShape: TWDataShape;

    thingworxFilterWithRule(rule: Rule): any {
        let filter: any = {
            fieldName: rule.field,
            type: ThingworxTypeMap[rule.operator]
        }
    
        switch (rule.operator) {
            case 'equal':
            case 'not_equal':
            case 'greater':
            case 'greater_or_equal':
            case 'less':
            case 'less_or_equal':
                switch (this.dataShape.fieldDefinitions[rule.id].baseType) {
                    case 'DATETIME':
                        filter.value = +moment(rule.value, 'DD/MM/YYYY HH:mm:ss');
                        break;
                    default:
                        filter.value = rule.value;
                }
                break;
            case 'true':
                filter.value = true;
                break;
            case 'false':
                filter.value = false;
                break;
            case 'begins_with':
                filter.value = rule.value + '%';
                break;
            case 'ends_with':
                filter.value = '%' + rule.value;
                break;
            case 'contains':
                filter.value = '%' + rule.value + '%';
                break;
            case 'between':
            case 'not_between':
                switch (this.dataShape.fieldDefinitions[rule.id].baseType) {
                    case 'DATETIME':
                        filter.from = +moment(rule.value[0], 'DD/MM/YYYY HH:mm:ss');
                        filter.to = +moment(rule.value[1], 'DD/MM/YYYY HH:mm:ss');
                        break;
                    default:
                        filter.from = rule.value[0];
                        filter.to = rule.value[1];
                }
                break;
            default: return undefined;
        }

        return filter;
    }

    onQueryChanged = (event) => {
        let rules: RuleGroup = (<any>this.jqElement).queryBuilder('getRules', {skip_empty: true, allow_invalid: true});
        let query;

        if (rules) {
            query = {
                filters: {
                    type: rules.condition,
                    filters: []
                }
            };
            this.convertRules(rules.rules, {toThingworxQueryArray: query.filters.filters});
        } else {
            query = {};
        }
        this.setProperty('Query', query);
        if((rules && rules.valid) || (rules.rules.length == 0 && !rules.valid)) {
            this.jqElement.triggerHandler('QueryChanged');
        }
    }

    convertRules(rules: (Rule | RuleGroup)[], {toThingworxQueryArray: filters}: {toThingworxQueryArray: any[]}): void {
        for (let rule of rules) {
            if (isRuleGroup(rule)) {
                let filter = {
                    type: rule.condition,
                    filters: []
                };
                filters.push(filter);

                this.convertRules(rule.rules, {toThingworxQueryArray: filter.filters});
            }
            else {
                let filter = this.thingworxFilterWithRule(rule);
                if (filter) filters.push(filter);
            }
        }
    }

    @TWProperty('Query') 
    set query(value: any) {
        
    };

    @TWProperty('UseFieldDescriptions') 
    set useDescriptions(use: boolean) {

    };

    @TWProperty('Data') set data(data: TWInfotable) {
        if (!data) return;

        // Check to see if an update is required
        if (this.dataShape) {
            let currentKeys = Object.keys(this.dataShape.fieldDefinitions).sort();
            let newKeys = Object.keys(data.dataShape.fieldDefinitions).sort();
            let identicalDataShapes = JSON.stringify(currentKeys) === JSON.stringify(newKeys);

            if (identicalDataShapes) return;
            // remove the existing listener since it will crash anyway
            this.jqElement.off('rulesChanged.queryBuilder', this.onQueryChanged);
            (<any>this.jqElement).queryBuilder('destroy');
            this.setProperty('Query', undefined);
            this.jqElement.triggerHandler('QueryChanged');
        }

        this.dataShape = data.dataShape;

        let filters: any = [];
        for (let key in this.dataShape.fieldDefinitions) {
            switch (this.dataShape.fieldDefinitions[key].baseType) {
                case 'STRING':
                    filters.push({
                        id: key,
                        label: this.useDescriptions ? this.dataShape.fieldDefinitions[key].description || key : key,
                        type: 'string',
                        operators: ['equal', 'contains', 'begins_with', 'ends_with']
                    });
                    break;
                case 'NUMBER':
                    filters.push({
                        id: key,
                        label: this.useDescriptions ? this.dataShape.fieldDefinitions[key].description || key : key,
                        type: 'double',
                        operators: ['equal', 'not_equal', 'greater', 'greater_or_equal', 'between', 'not_between', 'less', 'less_or_equal']
                    });
                    break;
                case 'INTEGER':
                case 'LONG':
                    filters.push({
                        id: key,
                        label: this.useDescriptions ? this.dataShape.fieldDefinitions[key].description || key : key,
                        type: 'integer',
                        operators: ['equal', 'not_equal', 'greater', 'greater_or_equal', 'between', 'not_between', 'less', 'less_or_equal']
                    });
                    break;
                case 'BOOLEAN':
                    filters.push({
                        id: key,
                        label: this.useDescriptions ? this.dataShape.fieldDefinitions[key].description || key : key,
                        type: 'boolean',
                        operators: ['equal'],
                        input: 'radio',
                        values: ['true', 'false']
                    });
                    break;
                case 'DATETIME':
                    filters.push({
                        id: key,
                        label: this.useDescriptions ? this.dataShape.fieldDefinitions[key].description || key : key,
                        type: 'datetime',
                        plugin: 'datetimepicker',
                        plugin_config: {
                            timeFormat: 'hh:mm:ss',
                            dateFormat: 'dd/mm/yy'
                        },
                        operators: ['equal', 'not_equal', 'greater', 'greater_or_equal', 'between', 'not_between', 'less', 'less_or_equal']
                    });
                    break;
                default: continue;
            }
        }

        (<any>this.jqElement).queryBuilder({filters});
        this.jqElement.on('rulesChanged.queryBuilder', this.onQueryChanged);
    }

    renderHtml(): string {
        require("./styles/runtime.css");
        require("./styles/query-builder.default.min.css");
        require("./styles/no-bootstrap.css");
        require('jQuery-QueryBuilder');
        return '<div class="widget-content widget-demo"></div>';
    };

    async afterRender(): Promise<void> {
        
    }

    serviceInvoked(name: string): void {}

    updateProperty(info: TWUpdatePropertyInfo): void {}

    @TWService("TestService")
    testService(): void {
        alert("Called via binding");
    }

    beforeDestroy?(): void {
        // resetting current widget
    }
}

setTimeout(function dhtml() {

    if ('dhtmlXGridObject' in window) {
        (<any>window).dhtmlXGridObject.prototype._get_json_data = function(b, a) {
            var c = b.data[a];
            if (typeof c == "object") {
                return c ? c.value : ""
            } else {
                return (typeof c === 'undefined') ? '' : c;
            }
        };
    }
    else {
        setTimeout(dhtml, 1000);
    }

}, 1000);