from tensorflow.keras.models import Model
import tensorflow as tf
import numpy as np
from lime import lime_image
from skimage.segmentation import mark_boundaries

import cv2

from constants import *

class GradCAM:
    def __init__(self, model, classIdx=None, layerName=None):
        # store the model, the class index used to measure the class
        # activation map, and the layer to be used when visualizing
        # the class activation map
        self.model = model
        self.classIdx = classIdx
        self.layerName = layerName
        # if the layer name is None, attempt to automatically find
        # the target output layer
        if self.layerName is None:
            self.layerName = self.find_target_layer()

    def find_target_layer(self):
        # attempt to find the final convolutional layer in the network
        # by looping over the layers of the network in reverse order
        for layer in reversed(self.model.layers):
            # check to see if the layer has a 4D output
            if len(layer.output_shape) == 4:
                return layer.name
        # otherwise, we could not find a 4D layer so the GradCAM
        # algorithm cannot be applied
        raise ValueError("Could not find 4D layer. Cannot apply GradCAM.")


    def compute_heatmap(self, image, colormap=cv2.COLORMAP_VIRIDIS, eps=1e-8):
        # construct our gradient model by supplying (1) the inputs
        # to our pre-trained model, (2) the output of the (presumably)
        # final 4D layer in the network, and (3) the output of the
        # softmax activations from the model
        image_re = image.reshape((1, WIDTH, HEIGHT, 3))

        gradModel = Model(
            inputs=[self.model.inputs],
            outputs=[self.model.get_layer(self.layerName).output, self.model.output])

        # record operations for automatic differentiation
        with tf.GradientTape() as tape:
            # cast the image tensor to a float-32 data type, pass the
            # image through the gradient model, and grab the loss
            # associated with the specific class index
            inputs = tf.cast(image_re, tf.float32)
            (convOutputs, predictions) = gradModel(inputs)
            
            loss = predictions[:, tf.argmax(predictions[0])]
    
        # use automatic differentiation to compute the gradients
        grads = tape.gradient(loss, convOutputs)

        # compute the guided gradients
        castConvOutputs = tf.cast(convOutputs > 0, "float32")
        castGrads = tf.cast(grads > 0, "float32")
        guidedGrads = castConvOutputs * castGrads * grads
        # the convolution and guided gradients have a batch dimension
        # (which we don't need) so let's grab the volume itself and
        # discard the batch
        convOutputs = convOutputs[0]
        guidedGrads = guidedGrads[0]

        # compute the average of the gradient values, and using them
        # as weights, compute the ponderation of the filters with
        # respect to the weights
        weights = tf.reduce_mean(guidedGrads, axis=(0, 1))
        cam = tf.reduce_sum(tf.multiply(weights, convOutputs), axis=-1)

        # grab the spatial dimensions of the input image and resize
        # the output class activation map to match the input image
        # dimensions
        (w, h) = (image_re.shape[2], image_re.shape[1])
        heatmap = cv2.resize(cam.numpy(), (w, h))
        # normalize the heatmap such that all values lie in the range
        # [0, 1], scale the resulting values to the range [0, 255],
        # and then convert to an unsigned 8-bit integer
        numer = heatmap - np.min(heatmap)
        denom = (heatmap.max() - heatmap.min()) + eps
        heatmap = numer / denom
        heatmap = (heatmap * 255).astype("uint8")

        heatmap = cv2.applyColorMap(heatmap, colormap)

        rgba = cv2.cvtColor(heatmap, cv2.COLOR_RGB2RGBA)

        # rgba(245,231,30,255) extreme yellow
        # rgba(73,41,120,255) extreme blue
        rgba[...,3] = (255-rgba[..., 0])
        return cv2.resize(rgba, (WIDTH, HEIGHT))

    def overlay_heatmap(self, heatmap, image, alpha=0.5,
                        colormap=cv2.COLORMAP_VIRIDIS):
        # apply the supplied color map to the heatmap and then
        # overlay the heatmap on the input image
        heatmap = cv2.applyColorMap(heatmap, colormap)
        output = cv2.addWeighted(image, alpha, heatmap, 1 - alpha, 0)
        # return a 2-tuple of the color mapped heatmap and the output,
        # overlaid image
        return (heatmap, output)

class Lime:

    def __init__(self, model):
        self.explainer = lime_image.LimeImageExplainer()
        self.model = model

    def get_explanation(self, image):
        image_re = image.reshape((WIDTH, HEIGHT, 3))
        explanation = self.explainer.explain_instance(image_re.astype('uint8'), self.model.predict,  
                                         top_labels=3, hide_color=1, num_samples=500)
        temp_1, mask_1 = explanation.get_image_and_mask(explanation.top_labels[0], positive_only=False, num_features=5, hide_rest=True)
        return mark_boundaries(temp_1, mask_1)

class Outlining:

    def __draw_bounding_box(self, heatmap, blankImg):
        image = blankImg.copy()
        gray = cv2.cvtColor(heatmap, cv2.COLOR_BGR2GRAY)
        thresh = cv2.threshold(gray, 100, 100, 0)[1]

        cnts = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = cnts[0] if len(cnts) == 2 else cnts[1]
        for c in cnts:
            x,y,w,h = cv2.boundingRect(c)
            w *= 0.9
            h *= 0.65
            w, h = int(w), int(h)
            rect = cv2.rectangle(image, (x, y), (x + w, y + h), (36,255,12), 2)

        rgba = cv2.cvtColor(image, cv2.COLOR_RGB2RGBA)
        rgba[np.where(np.all(rgba[..., :3] == 255, -1))] = 0
        return rgba

    def __draw_arrows(self, heatmap, blankImg):
        image = blankImg.copy()
    
        gray = cv2.cvtColor(heatmap, cv2.COLOR_BGR2GRAY)
        thresh = cv2.threshold(gray, 100, 100, 0)[1]

        cnts = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = cnts[0] if len(cnts) == 2 else cnts[1]
        for c in cnts:
            x,y,w,h = cv2.boundingRect(c)
            w *= 0.9
            h *= 0.65

            w, h = int(w), int(h)

            color = (0, 0, 245)
            thickness = 2

            # top left
            start_point = (x, y)
            end_point = (x + int(0.25 * w), y + int(0.25 * h))
            image = cv2.arrowedLine(image, start_point, end_point,
                                            color, thickness)
            # bottom right
            start_point2 = (x + w, y + h)
            end_point2 = (x + int(0.75 * w), y + int(0.75 * h))
            image = cv2.arrowedLine(image, start_point2, end_point2,
                                            color, thickness)
            # bottom left
            start_point3 = (x, y + h)
            end_point3 = (x + int(0.25 * w), y + int(0.75 * h) )
            image = cv2.arrowedLine(image, start_point3, end_point3,
                                            color, thickness)
            # top right
            start_point4 = (x + w, y)
            end_point4 = (x + int(0.75 * w), y + int(0.25 * h) )
            image = cv2.arrowedLine(image, start_point4, end_point4,
                                            color, thickness)

        rgba = cv2.cvtColor(image, cv2.COLOR_RGB2RGBA)
        rgba[np.where(np.all(rgba[..., :3] == 255, -1))] = 0
        return rgba

    __blankImg = np.zeros([WIDTH,HEIGHT,3],dtype=np.uint8)
    __blankImg.fill(255)

    def drawHeatmapBasedArrows(self, heatmap):
        return self.__draw_arrows(heatmap, self.__blankImg)

    def drawHeatmapBasedBoundingBox(self, heatmap):
        return self.__draw_bounding_box(heatmap, self.__blankImg)