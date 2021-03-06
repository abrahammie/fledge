import * as types from '../constants/actionTypes';

export const logIn = () => ({ type: types.LOG_IN, payload: true });
export const fetchApplicationsSuccess = res => ({ type: types.FETCH_SUCCESS, payload: res });
export const logOut = () => ({ type: types.LOG_OUT, payload: false });
