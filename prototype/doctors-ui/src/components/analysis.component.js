import React, { useContext, useEffect } from "react";
import { StepContext } from "../context/StepContext";
import Slider from '@mui/material/Slider';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';


import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import AnalysisDisplayService from "../services/analysis.service";

import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import { Button, Tooltip } from "@mui/material";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Icon from '@mui/material/Icon';

import AnalysisUserNotes from "./analysis-notes.component";

import BarChart from "./chart.component";


export default function Analysis(props) {

    const prefixImage = "data:image/png;base64" // necessary to decode the base64 string and display an actual image

    const setResponse = (response) => {
        let layers = response.explanations
        // enhancing the images with information needed in the frontend (active, style for opacity)
        layers = layers.map(layer => {
            return {
                ...layer,
                "active": true,
                "style": { // base style for layered images
                    "opacity": layer.name.includes("Heatmap") ? 0.8 : 1.0,
                    "display": "block",
                    "width": layer.width * 1.5
                },
                "image": `${prefixImage}, ${layer.image}`
            }
        })

        const baseImage = {
            ...response.baseImage,
            "style": {
                "width": response.baseImage.width * 1.5
            }
        }

        const klScores = response.klScores
        const maxKlScore = klScores.distributions.sort((k, l) => { return l.prob - k.prob })[0]

        klScores.distributions = klScores.distributions.sort((k, l) => { return k.score - l.score })
        klScores.distributions = klScores.distributions.map(s => { return { ...s, "prob": s.prob * 100 } })

        const chartData = {
            labels: klScores.distributions.map(s => s.score),
            datasets: [
                {
                    label: "Kellgren-Lawrence Score",
                    data: klScores.distributions.map(s => s.prob),
                    backgroundColor: [
                        "#2a71d0"
                    ]
                }
            ]
        }

        setValue(value => ({
            ...value,
            "layers": layers,
            "selectedLayerIndex": 0,
            "baseImage": baseImage,
            "klScores": klScores,
            "klScore": maxKlScore.score,
            "chartData": chartData,
            "loading": false
        }))

        setContext(context => ({
            ...context,
            "images": {
                "baseImage": baseImage,
                "explanations": value.layers
            },
            "klScores": {
                ...context.klScores,
                distributions: klScores.distributions
            },
            "klScore": maxKlScore.score
        }))
    }

    const [context, setContext] = useContext(StepContext);
    const [value, setValue] = React.useState({
        "layers": [],
        "loading": false
    });

    // useEffect is being run before and after each render of the site, to limit the API call only to when no data is in the frontend, the if-clause is introduced
    useEffect(() => {
        if (value.layers.length === 0) {
            setValue({ ...value, loading: true })
            AnalysisDisplayService.fetchData(context.previewImage, setResponse)
        }
    }, [])

    const handleOpacity = (newOpacity, layer) => {
        let copyLayer = layer
        let copyLayers = value.layers
        let index = copyLayers.indexOf(copyLayer)

        copyLayer.style = { ...copyLayer.style, "opacity": newOpacity }
        copyLayers[index] = copyLayer
        setValue({ ...value, "layers": copyLayers })
    };

    const toggleVisibility = (checked, layer) => {
        let copyLayer = layer
        let copyLayers = value.layers
        let index = copyLayers.indexOf(copyLayer)

        if (copyLayer.active)
            copyLayer.style = { ...copyLayer.style, "display": "none" }
        else
            copyLayer.style = { ...copyLayer.style, "display": "block" }
        copyLayer.active = checked
        copyLayers[index] = copyLayer
        setValue({ ...value, "layers": copyLayers })
    }

    const selectExplanationLayer = (event) => {
        setValue({ ...value, "selectedLayerIndex": event.target.value })
    }

    return (
        <div>

            <Stack direction="row" alignItems="flex-start" justifyContent="center" spacing={2}>

                {value.loading &&
                    <Stack spacing={1}>
                        <Skeleton animation="wave" variant="rectangular" width={"300px"} height={"125px"} />
                        <Skeleton animation="wave" variant="rectangular" width={"300px"} height={"300px"} />
                    </Stack>
                }

                {!value.loading &&
                    // left column
                    <Stack>
                        <Box fullWidth>
                            <Card variant="outlined">
                                {
                                    <React.Fragment>
                                        <CardContent>
                                            <Typography sx={{ fontSize: 14 }} align='center' color="#D1682E" gutterBottom>
                                                Predicted Kellgren-Lawrence Score
                                            </Typography>
                                            <Typography variant="h5" component="div" color="#D1682E" align='center'>
                                                {value.klScore}
                                            </Typography>
                                        </CardContent>
                                    </React.Fragment>
                                }

                                <Tooltip placement="left-end" title={
                                    <React.Fragment>
                                        <Typography color="inherit">Calculated KL Score</Typography>
                                        <Typography paragraph sx={{ fontSize: 12 }} display="block">
                                            The KL score that the smart assistant calculated when assessing the XRay image
                                        </Typography>
                                    </React.Fragment>
                                }>
                                    <Icon style={{ float: 'right', color: 'inherit' }} >
                                        <InfoOutlinedIcon fontSize="small" />
                                    </Icon>
                                </Tooltip>
                            </Card>
                        </Box>

                        {value.chartData &&
                            <BarChart height="300px" chartData={value.chartData} callback={(v) => {
                                console.log("CALLBACK BITCH")
                                setContext(context => ({
                                    ...context,
                                    visualization: v,
                                    klScores: {
                                        visualization: v
                                    }
                                }))
                            }} />
                        }

                    </Stack>
                }

                {/* middle column */}
                <div>
                    {value.loading && (
                        <Stack spacing={1}>
                            <Skeleton animation="wave" variant="rectangular" width={336} height={366} />
                            <Skeleton animation="wave" variant="rectangular" width={336} height={100} />
                        </Stack>
                    )}

                    {!value.loading && value.baseImage && (
                        <Stack className="analysis-view" justifyContent="column" alignItems="center" spacing={1}>

                            {/* view images */}
                            <Box id="image-view">
                                <Box width={value.baseImage.width * 1.5} height={value.baseImage.height * 1.5} />
                                <img className="layer baseImage" key="baseImage" src={`${prefixImage}, ${value.baseImage.image}`} style={value.baseImage.style} />
                                {value.layers.length > 0 && value.layers[value.selectedLayerIndex].description && value.layers[value.selectedLayerIndex].description !== "" &&
                                    <Tooltip placement="left-end" title={value.layers[value.selectedLayerIndex].description}>
                                        <img className="layer" src={value.layers[value.selectedLayerIndex].image} style={value.layers[value.selectedLayerIndex].style} />
                                    </Tooltip>
                                }
                                {value.layers.length > 0 && (!value.layers[value.selectedLayerIndex].description || value.layers[value.selectedLayerIndex].description === "") &&
                                    <img className="layer" src={value.layers[value.selectedLayerIndex].image} style={value.layers[value.selectedLayerIndex].style} />
                                }
                            </Box>

                            {value.layers.length > 0 &&
                                <Stack id="editor" justifyContent="column" alignItems="center">
                                    <Box className='menu-input'>
                                        <FormControl className='menu-input' sx={{ width: value.baseImage.width * 1.5 }}>
                                            <InputLabel id="explanation-select-label">Explanation</InputLabel>
                                            <Select
                                                labelId="explanation-select-label"
                                                id="explanation-select"
                                                value={value.selectedLayerIndex}
                                                label="Explanations"
                                                onChange={selectExplanationLayer}
                                            >
                                                {value.layers.map((layer, index) => {
                                                    return <MenuItem key={`explanation-select-${index}`} value={index}> {layer.name} </MenuItem>
                                                })
                                                }
                                            </Select>
                                        </FormControl>

                                        <Stack className="editing-functions" flexDirection="row" alignItems="center">
                                            <Tooltip title="Hide/Show layer">
                                                <Checkbox
                                                    onChange={(_, checked) => toggleVisibility(checked, value.layers[value.selectedLayerIndex])}
                                                    checked={value.layers[value.selectedLayerIndex].active}
                                                    icon={<VisibilityOffIcon />}
                                                    checkedIcon={<VisibilityIcon />} />
                                            </Tooltip>
                                            {/* <Tooltip title="Change layer opacity"> */}
                                            <Slider
                                                aria-labelledby="input-slider"
                                                className="slider"
                                                onChange={(_, opacity) => { handleOpacity(opacity, value.layers[value.selectedLayerIndex]) }} // change-handler (updating and rerendering images with new opacity)
                                                min={0}
                                                step={0.01}
                                                max={1}
                                                value={value.layers[value.selectedLayerIndex].style.opacity} // the value (opacity) we are manipulation with this slider
                                                valueLabelDisplay="auto"
                                            />
                                            {/* </Tooltip> */}
                                        </Stack>
                                    </Box>
                                </Stack>
                            }
                        </Stack >
                    )}
                </div>

                {/* right column */}
                <Stack direction="column" alignItems="flex-start" justifyContent="center" spacing={2}>
                    <AnalysisUserNotes />

                    <Button fullWidth variant="contained" onClick={() => setContext(context => ({
                        ...context,
                        step: context.step + 1, // incrementing the step counter, we get navigated to the next step
                        images: {
                            ...value.images,
                            baseImage: value.baseImage,
                            explanations: value.layers
                        },
                        klScores: {
                            ...context.klScores,
                        }
                    }))} >Create Report</Button>
                </Stack>
            </Stack >
        </div>
    );
}
