import { Fragment, React } from "react";
import "./App.css";

import UploadImages from "./components/file-upload-component";
import PreviewImages from "./components/preview-image.component";
import Analysis from "./components/analysis.component";

import HorizontalNonLinearStepper from "./components/top-menu.component";

import { StepContextProvider } from "./context/StepContext";
import StagesOverview from "./components/stages-overview.component"
import Report from "./components/report.component";

function App() {

  const stageElements = [
    <UploadImages />,
    <PreviewImages/>,
    <Analysis/>,
    <Report/>
  ]

  const stageNames = [
    'Upload X-ray',
    'Preview X-ray',
    'Analysis',
    'Report',
  ];


  return (
    <StepContextProvider>
      <div className="container">
        <Fragment>
          <HorizontalNonLinearStepper stageNames={stageNames} />
          <div className="content">
            <StagesOverview stages={stageElements} />
          </div>
        </Fragment>
      </div>
    </StepContextProvider>
  );
}

export default App;