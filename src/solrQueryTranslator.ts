let query = { 
    "filters": { 
        "filters": [
            { "fieldName": "host", "type": "EQ", "value": "3" }, 
            { "fieldName": "proto", "type": "LIKE", "value": "4%" }, 
            { "fieldName": "keepalive", "from": 4, "to": 5, "type": "NOTBETWEEN" }, 
            { "fieldName": "port", "from": 5, "to": 5, "type": "BETWEEN" }, 
            { "filters": [{ 
                "fieldName": "name", 
                "type": "EQ", 
                "value": "6" 
            }], 
            "type": "AND" }
        ], 
        "type": "AND" 
    } 
};


const SPECIAL_CHARS = /(\+|-|&&|\|\||!|\(|\)|\{|\}|\[|\]|\^|"|~|\*|\?|:|\\|\/)/g;

interface TwxQuery {
    fieldName?: string;
    filters?: TwxQuery[];
    type: string;
}

interface GenericTwxQuery {
    query: TwxQuery;
    convertToSolr();
}

class EqualToQuery implements GenericTwxQuery {
    query: TwxQuery & { value: any }
    convertToSolr() {
        let queryValue: string = this.query.value.toString();
        return `${this.query.fieldName}:"${queryValue.replace(SPECIAL_CHARS, "\\")}"`;
    }
}

class LessThanQuery implements GenericTwxQuery {
    query: TwxQuery & { value: number }
    convertToSolr() {
        return `${this.query.fieldName}:[* TO ${this.query.value}]`;
    }
}

class GreaterThanQuery implements GenericTwxQuery {
    query: TwxQuery & { value: number }
    convertToSolr() {
        return `${this.query.fieldName}:[${this.query.value} TO *]`;
    }
}

class BetweenQuery implements GenericTwxQuery {
    query: TwxQuery & { from: number, to: number }
    convertToSolr() {
        return `${this.query.fieldName}:[${this.query.from} TO ${this.query.to}]`;
    }
}

class NotBetweenQuery implements GenericTwxQuery {
    query: TwxQuery & { from: number, to: number }
    convertToSolr() {
        return `NOT ${this.query.fieldName}:[${this.query.from} TO ${this.query.to}]`;
    }
}


class LikeQuery implements GenericTwxQuery {
    query: TwxQuery & { value: string }
    convertToSolr() {
        let queryValue: string = this.query.value.toString();
        queryValue = queryValue.replace(/%/g, "*");
        return `${this.query.fieldName}:"${queryValue.replace(SPECIAL_CHARS, "\\")}`;
    }
}

class InQuery implements GenericTwxQuery {
    query: TwxQuery & { value: string }
    convertToSolr() {
        let queryValues: string[] = this.query.value.split(',').map((value) => { return value.replace(SPECIAL_CHARS, "\\") });
        return `${this.query.fieldName}:["
            ${queryValues.join('", "')}
        "]`;
    }
}

class OrQuery implements GenericTwxQuery {
    query: TwxQuery;
    convertToSolr() {
        return "(" + this.query.filters.map((query) => { return queryToObject(query).convertToSolr() }).join(" OR ") + ")";
    }
}

class AndQuery implements GenericTwxQuery {
    query: TwxQuery;
    convertToSolr() {
        return "(" + this.query.filters.map((query) => { return queryToObject(query).convertToSolr() }).join(" AND ") + ")";
    }
}

const queryClasses = {
    EQ: EqualToQuery,
    LT: LessThanQuery,
    LE: LessThanQuery,
    GT: GreaterThanQuery,
    GE: GreaterThanQuery,
    BETWEEN: BetweenQuery,
    NOTBETWEEN: NotBetweenQuery,
    OR: OrQuery,
    AND: AndQuery,
    LIKE: LikeQuery,
    IN: InQuery,
    NOTIN: InQuery
}

export function queryToObject(query: TwxQuery): GenericTwxQuery {
    let result = new queryClasses[query.type];
    result.query = query;
    return result;
}