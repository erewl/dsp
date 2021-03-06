
from tensorflow import keras
import cv2
import numpy as np

from constants import *
class PredictionService:
    path = "models/model_2.h5" 

    def __init__(self):
        self.model = keras.models.load_model(self.path)
    
    def predict(self, input):
        input_reshape = cv2.resize(input, (WIDTH, HEIGHT)).reshape((1, WIDTH, HEIGHT, 3))
        predictions = self.model.predict(input_reshape)
        rounded_predictions = [np.round(prob, 5) for prob in predictions[0]]
        rounded_predictions_dict = [{'score': int(i), 'prob': float(prob)} for i, prob in enumerate(rounded_predictions)]
        return rounded_predictions_dict