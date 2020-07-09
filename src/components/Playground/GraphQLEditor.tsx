import CodeMirrorSizer from "graphiql/dist/utility/CodeMirrorSizer";
import { getLeft, getTop } from "graphiql/dist/utility/elementPosition";
import { fillLeafs } from "graphiql/dist/utility/fillLeafs";
import { GraphQLSchema, isNamedType } from "graphql";
import { List } from "immutable";
import * as React from "react";
import * as ReactDOM from "react-dom";
// Redux Dependencies
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import {
  closeQueryVariables,
  closeTracing,
  closeVariables,
  fetchSchema,
  openQueryVariables,
  openTracing,
  openVariables,
  runQueryAtPosition,
  setEditorFlex,
  stopQuery,
  toggleTracing,
  toggleVariables,
  updateQueryFacts,
} from "../../state/sessions/actions";
import { ResponseRecord } from "../../state/sessions/reducers";
import {
  getCurrentQueryEndTime,
  getCurrentQueryStartTime,
  getEditorFlex,
  getHeaders,
  getHeadersCount,
  getOperationName,
  getOperations,
  getQueryRunning,
  getQueryVariablesActive,
  getResponseExtensions,
  getResponses,
  getResponseTracingHeight,
  getResponseTracingOpen,
  getSelectedSessionIdFromRoot,
  getSubscriptionActive,
  getTracingSupported,
  getVariableEditorHeight,
  getVariableEditorOpen,
} from "../../state/sessions/selectors";
import { styled } from "../../styled/index";
import Spinner from "../Spinner";
import GraphDocs from "./DocExplorer/GraphDocs";
// import QueryEditor from "./QueryEditor";
import EditorWrapper, { Container } from "./EditorWrapper";
// Query & Response Components
import ExecuteButton from "./ExecuteButton";
// Explorer Components
import SideTab from "./ExplorerTabs/SideTab";
import SideTabs from "./ExplorerTabs/SideTabs";
import ResponseTracing from "./ResponseTracing";
import Results from "./Results";
import SDLView from "./SchemaExplorer/SDLView";
import TopBar from "./TopBar/TopBar";

/**
 * The top-level React component for GraphQLEditor, intended to encompass the entire
 * browser viewport.
 */

export interface Props {
  onRef?: any;
  shareEnabled?: boolean;
  fixedEndpoint?: boolean;
  schema?: GraphQLSchema;
}

export interface ReduxProps {
  setStacks: (sessionId: string, stack: any[]) => void;
  updateQueryFacts: () => void;
  runQueryAtPosition: (position: number) => void;
  fetchSchema: () => void;
  openQueryVariables: () => void;
  closeQueryVariables: () => void;
  openVariables: (height: number) => void;
  closeVariables: (height: number) => void;
  openTracing: (height: number) => void;
  closeTracing: (height: number) => void;
  toggleTracing: () => void;
  toggleVariables: () => void;
  setEditorFlex: (flex: number) => void;
  stopQuery: (sessionId: string) => void;
  navStack: any[];
  // sesion props
  queryRunning: boolean;
  responses: List<ResponseRecord>;
  subscriptionActive: boolean;
  variableEditorOpen: boolean;
  variableEditorHeight: number;
  currentQueryStartTime?: Date;
  currentQueryEndTime?: Date;
  responseTracingOpen: boolean;
  responseTracingHeight: number;
  responseExtensions: any;
  tracingSupported?: boolean;
  editorFlex: number;
  headers: string;
  headersCount: number;
  queryVariablesActive: boolean;
  operationName: string;
  query: string;
  sessionId: string;
}

export interface SimpleProps {
  children?: any;
}

export interface ToolbarButtonProps extends SimpleProps {
  onClick: (e: any) => void;
  title: string;
  label: string;
}

class GraphQLEditor extends React.PureComponent<Props & ReduxProps> {
  public codeMirrorSizer;
  public queryEditorComponent;
  public variableEditorComponent;
  public resultComponent;
  public editorBarComponent;
  public docExplorerComponent: any; // later React.Component<...>
  public graphExplorerComponent: any;
  public schemaExplorerComponent: any;
  private queryResizer: any;
  private responseResizer: any;
  private queryVariablesRef;
  private httpHeadersRef;

  componentDidMount() {
    // Ensure a form of a schema exists (including `null`) and
    // if not, fetch one using an introspection query.
    // this.props.fetchSchema()

    // Utility for keeping CodeMirror correctly sized.
    this.codeMirrorSizer = new CodeMirrorSizer();
    (global as any).g = this;
  }

  componentDidUpdate() {
    // If this update caused DOM nodes to have changed sizes, update the
    // corresponding CodeMirror instance sizes to match.
    // const components = [
    // this.queryEditorComponent,
    // this.variableEditorComponent,
    // this.resultComponent,
    // ]
    // this.codeMirrorSizer.updateSizes(components)
    if (this.resultComponent && Boolean(this.props.subscriptionActive)) {
      this.resultComponent.scrollTop = this.resultComponent.scrollHeight;
    }
  }

  render() {
    return (
      <Container>
        <EditorWrapper>
          <TopBar
            shareEnabled={this.props.shareEnabled}
            fixedEndpoint={this.props.fixedEndpoint}
          />
          <Intro>Hit the Play Button to get a response here</Intro>
        </EditorWrapper>
      </Container>
    );
  }

  setQueryVariablesRef = (ref) => {
    this.queryVariablesRef = ref;
  };

  setHttpHeadersRef = (ref) => {
    this.httpHeadersRef = ref;
  };

  setQueryResizer = (ref) => {
    this.queryResizer = ReactDOM.findDOMNode(ref);
  };

  setResponseResizer = (ref) => {
    this.responseResizer = ReactDOM.findDOMNode(ref);
  };

  setEditorBarComponent = (ref) => {
    this.editorBarComponent = ref;
  };

  setQueryEditorComponent = (ref) => {
    this.queryEditorComponent = ref;
  };

  setVariableEditorComponent = (ref) => {
    this.variableEditorComponent = ref;
  };

  setResultComponent = (ref) => {
    this.resultComponent = ref;
  };

  setDocExplorerRef = (ref) => {
    if (ref) {
      this.docExplorerComponent = ref.getWrappedInstance();
    }
  };
  setGraphExplorerRef = (ref) => {
    if (ref) {
      this.graphExplorerComponent = ref.getWrappedInstance();
    }
  };
  setSchemaExplorerRef = (ref) => {
    if (ref) {
      this.schemaExplorerComponent = ref.getWrappedInstance();
    }
  };

  handleClickReference = (reference) => {
    this.docExplorerComponent.showDocFromType(reference.field || reference);
  };

  /**
   * Inspect the query, automatically filling in selection sets for non-leaf
   * fields which do not yet have them.
   *
   * @public
   */
  autoCompleteLeafs() {
    const { insertions, result } = fillLeafs(
      this.props.schema,
      this.props.query
    ) as {
      insertions: Array<{ index: number; string: string }>;
      result: string;
    };
    if (insertions && insertions.length > 0) {
      const editor = this.queryEditorComponent.getCodeMirror();
      editor.operation(() => {
        const cursor = editor.getCursor();
        const cursorIndex = editor.indexFromPos(cursor);
        editor.setValue(result);
        let added = 0;
        try {
          /* tslint:disable-next-line */
          const markers = insertions.map(({ index, string }) =>
            editor.markText(
              editor.posFromIndex(index + added),
              editor.posFromIndex(index + (added += string.length)),
              {
                className: "autoInsertedLeaf",
                clearOnEnter: true,
                title: "Automatically added leaf fields",
              }
            )
          );
          setTimeout(() => markers.forEach((marker) => marker.clear()), 7000);
        } catch (e) {
          //
        }
        let newCursorIndex = cursorIndex;
        /* tslint:disable-next-line */
        insertions.forEach(({ index, string }) => {
          if (index < cursorIndex && string) {
            newCursorIndex += string.length;
          }
        });
        editor.setCursor(editor.posFromIndex(newCursorIndex));
      });
    }

    return result;
  }

  private handleHintInformationRender = (elem) => {
    elem.addEventListener("click", this.onClickHintInformation);

    let onRemoveFn;
    elem.addEventListener(
      "DOMNodeRemoved",
      (onRemoveFn = () => {
        elem.removeEventListener("DOMNodeRemoved", onRemoveFn);
        elem.removeEventListener("click", this.onClickHintInformation);
      })
    );
  };

  private handleResizeStart = (downEvent) => {
    console.log("handleResizeStart", downEvent);

    if (!this.didClickDragBar(downEvent)) {
      console.log("handleResizeStart:!didClickDragBar", downEvent);
      return;
    }

    downEvent.preventDefault();

    const offset = downEvent.clientX - getLeft(downEvent.target);

    let onMouseMove: any = (moveEvent) => {
      if (moveEvent.buttons === 0) {
        console.log("handleResizeStart:buttons=0", downEvent);
        return onMouseUp();
      }

      // console.log("handleResizeStart:onMouseMove", downEvent); //....

      const editorBar = ReactDOM.findDOMNode(this.editorBarComponent);
      const leftSize = moveEvent.clientX - getLeft(editorBar) - offset;
      const rightSize = editorBar.clientWidth - leftSize;
      this.props.setEditorFlex(leftSize / rightSize);
    };

    let onMouseUp: any = () => {
      // done: resizing
      console.log("handleResizeStart:onMouseUp", downEvent);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      onMouseMove = null;
      onMouseUp = null;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  private didClickDragBar(event) {
    // Only for primary unmodified clicks
    return (
      event.target === this.queryResizer ||
      event.target === this.responseResizer
    );
  }

  private handleTracingResizeStart = (downEvent) => {
    downEvent.preventDefault();

    let didMove = false;
    const hadHeight = this.props.responseTracingHeight;
    const offset = downEvent.clientY - getTop(downEvent.target);

    let onMouseMove: any = (moveEvent) => {
      if (moveEvent.buttons === 0) {
        return onMouseUp();
      }

      didMove = true;

      const editorBar = ReactDOM.findDOMNode(this.editorBarComponent);
      const topSize = moveEvent.clientY - getTop(editorBar) - offset;
      const bottomSize = editorBar.clientHeight - topSize;
      if (bottomSize < 60) {
        this.props.closeTracing(hadHeight);
      } else {
        this.props.openTracing(hadHeight);
      }
    };

    let onMouseUp: any = () => {
      if (!didMove) {
        this.props.toggleTracing();
      }

      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      onMouseMove = null;
      onMouseUp = null;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  private handleVariableResizeStart = (downEvent) => {
    downEvent.preventDefault();

    let didMove = false;
    const wasOpen = this.props.variableEditorOpen;
    const hadHeight = this.props.variableEditorHeight;
    const offset = downEvent.clientY - getTop(downEvent.target);

    if (
      wasOpen &&
      (downEvent.target === this.queryVariablesRef ||
        downEvent.target === this.httpHeadersRef)
    ) {
      return;
    }

    let onMouseMove: any = (moveEvent) => {
      if (moveEvent.buttons === 0) {
        return onMouseUp();
      }

      didMove = true;

      const editorBar = ReactDOM.findDOMNode(this.editorBarComponent);
      const topSize = moveEvent.clientY - getTop(editorBar) - offset;
      const bottomSize = editorBar.clientHeight - topSize;
      if (bottomSize < 60) {
        this.props.closeVariables(hadHeight);
      } else {
        this.props.openVariables(bottomSize);
      }
    };

    let onMouseUp: any = () => {
      if (!didMove) {
        this.props.toggleVariables();
      }

      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      onMouseMove = null;
      onMouseUp = null;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  private onClickHintInformation = (event) => {
    if (event.target.className === "typeName") {
      const typeName = event.target.innerHTML;
      const schema = this.props.schema;
      if (schema) {
        // TODO: There is no way as of now to retrieve the NAMED_TYPE of a GraphQLList(Type).
        // We're therefore removing any '[' or '!' characters, to properly find its NAMED_TYPE. (eg. [Type!]! => Type)
        // This should be removed as soon as there's a safer way to do that.
        const namedTypeName = typeName.replace(/[\]\[!]/g, "");
        const type = schema.getType(namedTypeName);

        if (isNamedType(type)) {
          this.docExplorerComponent.showDocFromType(type);
        }
      }
    }
  };
}

const mapStateToProps = createStructuredSelector({
  queryRunning: getQueryRunning,
  responses: getResponses,
  subscriptionActive: getSubscriptionActive,
  variableEditorOpen: getVariableEditorOpen,
  variableEditorHeight: getVariableEditorHeight,
  responseTracingOpen: getResponseTracingOpen,
  responseTracingHeight: getResponseTracingHeight,
  responseExtensions: getResponseExtensions,
  currentQueryStartTime: getCurrentQueryStartTime,
  currentQueryEndTime: getCurrentQueryEndTime,
  tracingSupported: getTracingSupported,
  editorFlex: getEditorFlex,
  queryVariablesActive: getQueryVariablesActive,
  headers: getHeaders,
  operations: getOperations,
  operationName: getOperationName,
  headersCount: getHeadersCount,
  sessionId: getSelectedSessionIdFromRoot,
});

export default // TODO fix redux types
connect<any, any, any>(
  mapStateToProps,
  {
    updateQueryFacts,
    stopQuery,
    runQueryAtPosition,
    openQueryVariables,
    closeQueryVariables,
    openVariables,
    closeVariables,
    openTracing,
    closeTracing,
    toggleTracing,
    setEditorFlex,
    toggleVariables,
    fetchSchema,
  },
  null,
  {
    withRef: true,
  }
)(GraphQLEditor);

const EditorBar = styled.div`
  display: flex;
  flex-direction: row;
  flex: 1;
`;

const ResultWrap = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
  border-left: none;
  background: ${(p) => p.theme.editorColours.resultBackground};
`;

const DragBar = styled.div`
  width: 15px;
  position: absolute;
  top: 0;
  bottom: 0;
  cursor: col-resize;
`;

const QueryDragBar = styled(DragBar)`
  right: 0px;
`;

const ResultDragBar = styled(DragBar)`
  left: 0px;
  z-index: 1;
`;

interface DrawerProps {
  isOpen: boolean;
  height: number;
}

const BottomDrawer = styled<DrawerProps, "div">("div")`
  display: flex;
  background: #0b1924;
  flex-direction: column;
  position: relative;
  height: ${(props) => (props.isOpen ? `${props.height}px` : "43px")};
`;

interface TitleProps {
  isOpen: boolean;
  onMouseDown?: any;
  onClick?: any;
  ref?: any;
}

const BottomDrawerTitle = styled.div`
  background: #0b1924;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.53px;
  line-height: 14px;
  font-size: 14px;
  padding: 14px 14px 15px 21px;
  user-select: none;
`;

const VariableEditor = styled(BottomDrawer)`
  .CodeMirror {
    padding-left: 4px;
    width: calc(100% - 4px);
    background: ${(p) => p.theme.editorColours.leftDrawerBackground};
  }
  .CodeMirror-lines {
    padding: 10px 0 20px 0;
  }
  .CodeMirror-linenumbers {
    background: ${(p) => p.theme.editorColours.leftDrawerBackground};
  }
`;

const VariableEditorTitle = styled<TitleProps>(({ isOpen, ...rest }) => (
  <BottomDrawerTitle {...rest} />
))`
  cursor: ${(p) => (p.isOpen ? "row-resize" : "n-resize")};
  background: ${(p) => p.theme.editorColours.leftDrawerBackground};
`;

const VariableEditorSubtitle = styled<TitleProps, "span">("span")`
  margin-right: 10px;
  cursor: pointer;
  color: ${(p) =>
    p.isOpen
      ? p.theme.editorColours.drawerText
      : p.theme.editorColours.drawerTextInactive};
  &:last-child {
    margin-right: 0;
  }
`;

const ResponseTracking = styled(BottomDrawer)`
  background: ${(p) => p.theme.editorColours.rightDrawerBackground};
`;

const ResponseTrackingTitle = styled<TitleProps>(({ isOpen, ...rest }) => (
  <BottomDrawerTitle {...rest} />
))`
  text-align: right;
  background: ${(p) => p.theme.editorColours.rightDrawerBackground};
  cursor: ${(props) => (props.isOpen ? "s-resize" : "n-resize")};
  color: ${(p) => p.theme.editorColours.drawerTextInactive};
`;

interface QueryProps {
  flex: number;
}

const QueryWrap = styled<QueryProps, "div">("div")`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: ${(props) => props.flex} 1 0%;
  border-top: 8px solid ${(props) => props.theme.editorColours.resultBackground};
  background: ${(p) => p.theme.editorColours.editorBackground};
  color: ${(p) => p.theme.colours.textInactive};
`;

const Intro = styled.div`
  width: 235px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: ${(p) => p.theme.colours.textInactive};
  font-size: ${(p) => p.theme.sizes.small16};
  font-family: "Source Code Pro", "Consolas", "Inconsolata", "Droid Sans Mono",
    "Monaco", monospace;
  text-align: center;
  letter-spacing: 0.6px;
`;

const Listening = styled.div`
  position: absolute;
  bottom: 0;
  color: ${(p) => p.theme.editorColours.text};
  background: ${(p) => p.theme.editorColours.resultBackground};
  font-size: ${(p) => p.theme.sizes.small16};
  font-family: ${(p) => p.theme.settings["editor.fontFamily"]};
  letter-spacing: 0.6px;
  padding-left: 24px;
  padding-bottom: 60px;
`;
