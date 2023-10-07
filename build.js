import { fileURLToPath } from "node:url";
import { dirname } from "path";
import Metalsmith from "metalsmith";
import layouts from "@metalsmith/layouts";
import inPlace from "@metalsmith/in-place";
import commandLineArgs from "command-line-args";

const OPTION_DEFS = [
    { name: "path", type: String, defaultValue: "/" },
    { name: "watch", type: Boolean },
];

const options = commandLineArgs( OPTION_DEFS );

const __dirname = dirname( fileURLToPath( import.meta.url ) );

const nunjuckOptions = {
    transform: "nunjucks",
    engineOptions: {
        root: __dirname + "/layouts",
        globals: {
            homePath: options.path
        }
    }
};

const ms = Metalsmith( __dirname );

ms.directory( __dirname )
    .source( "./app" )
    .destination( "./public" )
    .clean( true );

if ( options.watch ) {
    ms.watch( [ "./app", "./layouts" ] );
}

ms.use( inPlace( { transform: "marked" } ) )
    .use( inPlace( nunjuckOptions ) )
    .use( layouts( nunjuckOptions ) )
    .build(
        ( err ) => {
            if ( err ) {
                throw err;
            }
        }
    );            
