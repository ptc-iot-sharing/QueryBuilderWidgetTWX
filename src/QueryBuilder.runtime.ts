import { ThingworxRuntimeWidget, TWProperty } from 'typescriptwebpacksupport/widgetRuntimeSupport'
import { queryToObject } from './twxQueryToQueryBuilder';

const SPECIAL_CHARS = /(\+|-|&&|\|\||!|\(|\)|\{|\}|\[|\]|\^|"|~|\*|\?|:|\/)/g;

export interface Rule {
    id?: string,
    field: string,
    type?: string,
    input?: string,
    operator: string,
    value: any
}

export interface RuleGroup {
    condition: 'AND' | 'OR',
    rules: (Rule | RuleGroup)[],
    valid?: boolean
}

export interface TwxQuery {
    fieldName?: string;
    filters?: TwxQuery[] | TwxQuery;
    type: string;
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

    /**
     * Is a query set in progress
     */
    queryUpdating: boolean;

    /**
     * The current query displayed
     */
    savedQuery: TwxQuery;

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
                if(rule.field.endsWith("~AgeInDays~")) {
                    filter.value = rule.value;
                    break;
                } 
                switch (this.dataShape.fieldDefinitions[rule.id].baseType) {
                    case 'DATETIME':
                        filter.value = this.convertDateTimeToTimestamp(rule.value);
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
                filter.value = rule.value.replace(SPECIAL_CHARS, '\\$&') + '%';
                break;
            case 'ends_with':
                filter.value = '%' + rule.value.replace(SPECIAL_CHARS, '\\$&');
                break;
            case 'contains':
                filter.value = '%' + rule.value.replace(SPECIAL_CHARS, '\\$&') + '%';
                break;
            case 'between':
            case 'not_between':
                if (rule.field.endsWith("~AgeInDays~")) {
                    filter.from = rule.value[0];
                    filter.to = rule.value[1];
                    break;
                } 
                switch (this.dataShape.fieldDefinitions[rule.id].baseType) {
                    case 'DATETIME':
                        filter.from = this.convertDateTimeToTimestamp(rule.value[0]);
                        filter.to = this.convertDateTimeToTimestamp(rule.value[1]);
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
        if (this.queryUpdating || (<any>this.jqElement).queryBuilder('getModel') == null) {
            return;
        }
        let rules: RuleGroup = (<any>this.jqElement).queryBuilder('getRules', { skip_empty: true, allow_invalid: true });
        let {containsValidQuery, isQueryEmpty} = this.getQueryState(rules);
        let query;

        if (rules) {
            query = {
                filters: {
                    type: rules.condition,
                    filters: []
                }
            };
            this.convertRules(rules.rules, { toThingworxQueryArray: query.filters.filters });
        } else {
            query = {};
        }
        this.setProperty("ContainsValidQuery", containsValidQuery);
        this.setProperty("IsQueryEmpty", isQueryEmpty);

        this.setProperty('Query', query);
        if (containsValidQuery || isQueryEmpty) {
            this.jqElement.triggerHandler('QueryChanged');
        }
    }

    convertDateTimeToTimestamp(value) {
        const momentObject = moment(value, 'DD/MM/YYYY HH:mm:ss');
        return momentObject.isValid() ? +momentObject : +moment(value);
    }

    getQueryState(rules: RuleGroup) {
        return {
            containsValidQuery: (rules && rules.valid),
            isQueryEmpty: (rules.rules.length == 0 && !rules.valid)
        }
        
    }

    convertRules(rules: (Rule | RuleGroup)[], { toThingworxQueryArray: filters }: { toThingworxQueryArray: any[] }): void {
        for (let rule of rules) {
            if (isRuleGroup(rule)) {
                let filter = {
                    type: rule.condition,
                    filters: []
                };
                filters.push(filter);

                this.convertRules(rule.rules, { toThingworxQueryArray: filter.filters });
            }
            else {
                let filter = this.thingworxFilterWithRule(rule);
                if (filter) filters.push(filter);
            }
        }
    }

    @TWProperty('UseFieldDescriptions')
    set useDescriptions(use: boolean) {

    };

    @TWProperty('UseRowsAsValues')
    set useRowsAsValues(use: boolean) {

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
                case 'TEXT':
                    let filter = {
                        id: key,
                        label: this.useDescriptions ? this.dataShape.fieldDefinitions[key].description || key : key,
                        type: "string"
                    };
                    if (this.useRowsAsValues) {
                        (<any>filter).values = data.rows.map((row) => row[key]);
                        (<any>filter).operators = ['equal', 'not_equal'];
                        (<any>filter).input = "select";
                    } else {
                        (<any>filter).operators = ['equal', "not_equal", 'contains', 'begins_with', 'ends_with'];
                    }
                    filters.push(filter);
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
                        operators: ['equal', 'not_equal', 'greater', 'greater_or_equal', 'between', 'not_between', 'less', 'less_or_equal'],
                        validation: {
                            min: -2147483648,
                            max: 2147483647
                        }
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
                    let label = this.useDescriptions ? this.dataShape.fieldDefinitions[key].description || key : key;
                    filters.push({
                        id: key,
                        label: label,
                        type: 'datetime',
                        plugin: 'datetimepicker',
                        plugin_config: {
                            timeFormat: 'hh:mm:ss',
                            dateFormat: 'dd/mm/yy'
                        },
                        valueSetter: (rule, value) => {
                            let inputs = rule.$el.find('input');
                            if(inputs.length == 1) {
                                // this is a normal range filter
                                inputs.val(moment(value).format("DD/MM/YYYY HH:mm:ss"));
                            } else if(inputs.length == 2 && value.length == 2) {
                                // this is a between filter
                                inputs.eq(0).val(moment(value[0]).format("DD/MM/YYYY HH:mm:ss"));
                                inputs.eq(1).val(moment(value[1]).format("DD/MM/YYYY HH:mm:ss"));
                            }
                        },
                        operators: ['equal', 'not_equal', 'greater', 'greater_or_equal', 'between', 'not_between', 'less', 'less_or_equal']
                    });
                    if(this.getProperty("EnableDateTimeAgeFilter")) {
                        filters.push({
                            id: key + "~AgeInDays~",
                            label: "Today – " + label + " (in days)",
                            type: 'integer',
                            operators: ['equal', 'not_equal', 'greater', 'greater_or_equal', 'between', 'not_between', 'less', 'less_or_equal']
                        });
                    }
                    break;
                default: continue;
            }
        }
        let conditionsArray = [];
        if(this.getProperty("AllowAnd") === undefined || this.getProperty("AllowAnd")) {
            conditionsArray.push("AND");
        }
        if(this.getProperty("AllowOr") === undefined || this.getProperty("AllowOr")) {
            conditionsArray.push("OR");
        }


        (<any>this.jqElement).queryBuilder({ filters, allow_groups: this.getProperty("AllowGroups"), conditions: conditionsArray });
        this.jqElement.on('rulesChanged.queryBuilder', this.onQueryChanged);
        if(this.savedQuery) {
            this.updateProperty(<any>{
                TargetProperty: "Query",
                RawSinglePropertyValue: this.savedQuery
            })
        } else {
            this.setProperty("ContainsValidQuery", false);
            this.setProperty("IsQueryEmpty", true);
        }
    }

    renderHtml(): string {
        require("./styles/runtime.css");
        require("./styles/query-builder.default.min.css");
        require("./styles/no-bootstrap.css");
        require('jQuery-QueryBuilder');
        return '<div class="widget-content widget-demo"></div>';
    };

    async afterRender(): Promise<void> {
        this.setProperty("ContainsValidQuery", false);
        this.setProperty("IsQueryEmpty", true);
    }

    serviceInvoked(name: string): void { }

    updateProperty(info: TWUpdatePropertyInfo): void {
        if (info.TargetProperty == "Query") {
            if (info.RawSinglePropertyValue && info.RawSinglePropertyValue.filters) {
                this.savedQuery = info.RawSinglePropertyValue;
                // transforms the query into a QueryBuilderQuery and update the UI
                this.queryUpdating = true;
                (<any>this.jqElement).queryBuilder('setRules', queryToObject(<TwxQuery>info.RawSinglePropertyValue.filters).convertToRule());
                this.queryUpdating = false;
                // determine if the query is valid and non empty
                let rules = (<any>this.jqElement).queryBuilder('getRules', { skip_empty: true, allow_invalid: true });
                let {containsValidQuery, isQueryEmpty} = this.getQueryState(rules);
                this.setProperty("ContainsValidQuery", containsValidQuery);
                this.setProperty("IsQueryEmpty", isQueryEmpty);
                this.setProperty("Query", info.RawSinglePropertyValue);

                this.jqElement.triggerHandler('QueryChanged');
            } else {
                (<any>this.jqElement).queryBuilder('reset');
            }
        }
        this.setProperty(info.TargetProperty, info.RawSinglePropertyValue);
    }

    beforeDestroy?(): void {
        // resetting current widget
        (<any>this.jqElement).queryBuilder('destroy');
    }
}

setTimeout(function dhtml() {

    if ('dhtmlXGridObject' in window) {
        (<any>window).dhtmlXGridObject.prototype._get_json_data = function (b, a) {
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
