class DateUtils {

    static getCurrentYear() {
        return new Date().getFullYear();
    }

    static getDateString( d ) {
        return d.getFullYear().toString() + "-" + ( d.getMonth() + 101 ).toString().substring( 1 ) + "-"
            + ( d.getDate() + 100 ).toString().substring( 1 );
    }

}

export { DateUtils };