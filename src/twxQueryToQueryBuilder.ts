import { Rule, RuleGroup, TwxQuery } from "./QueryBuilder.runtime";

const ESCAPED_SPECIAL_SYMBOLS = /(\\)((\+|-|&&|\|\||!|\(|\)|\{|\}|\[|\]|\^|"|~|\*|\?|:|\/))/g;

interface GenericTwxQuery {
    query: TwxQuery;
    convertToRule(): Rule | RuleGroup;
}

class ComparisonToQuery implements GenericTwxQuery {
    comparisionMap = {
        EQ: "equal",
        NE: "not_equal",
        GT: "greater",
        GE: "greater_or_equal",
        LT: "less",
        LE: "less_or_equal"
    }
    query: TwxQuery & { value: any }
    convertToRule() {
        return {
            field: this.query.fieldName,
            operator: this.comparisionMap[this.query.type],
            value: this.query.value,
            id: this.query.fieldName
        };
    }
}


class BetweenQuery implements GenericTwxQuery {
    comparisionMap = {
        BETWEEN: "between",
        NOTBETWEEN: "not_between"
    }
    query: TwxQuery & { from: number, to: number }
    convertToRule() {
        return {
            field: this.query.fieldName,
            operator: this.comparisionMap[this.query.type],
            value: [this.query.from, this.query.to],
            id: this.query.fieldName
        };
    }
}

class LikeQuery implements GenericTwxQuery {
    query: TwxQuery & { value: string }
    convertToRule() {
        let rule;
        let value;
        if (this.query.value[0] == "%" && this.query.value[this.query.value.length - 1] == "%") {
            rule = "contains";
            value = this.query.value.slice(1, -1);
        } else if (this.query.value[0] == "%") {
            rule = "ends_with";
            value = this.query.value.slice(1);
        } else if (this.query.value[this.query.value.length - 1] == "%") {
            rule = "begins_with";
            value = this.query.value.slice(0, -1);
        }
        return {
            field: this.query.fieldName,
            operator: rule,
            value: value.replace(ESCAPED_SPECIAL_SYMBOLS, '$2'),
            id: this.query.fieldName
        };
    }
}

class GroupQuery implements GenericTwxQuery {
    comparisionMap = {
        OR: "OR",
        AND: "AND"
    }
    query: TwxQuery & { filters: TwxQuery[] };
    convertToRule(): RuleGroup {
        return {
            condition: this.comparisionMap[this.query.type],
            rules: this.query.filters.map((query) => { return queryToObject(query).convertToRule() }),
        }
    }
}

const queryClasses = {
    EQ: ComparisonToQuery,
    LT: ComparisonToQuery,
    LE: ComparisonToQuery,
    GT: ComparisonToQuery,
    GE: ComparisonToQuery,
    NE: ComparisonToQuery,
    BETWEEN: BetweenQuery,
    NOTBETWEEN: BetweenQuery,
    OR: GroupQuery,
    AND: GroupQuery,
    LIKE: LikeQuery
}

export function queryToObject(query: TwxQuery): GenericTwxQuery {
    let result = new queryClasses[query.type];
    result.query = query;
    return result;
}
