// @ts-nocheck
import API from "./api";

/**
 * commentApi.js
 * Frontend service to interact with the backend comment system.
 */

export const getComments = async (animeId, episodeNum = null) => {
  const epParam = episodeNum ? `?episodeNum=${episodeNum}` : "";
  const res = await API.get(`/api/comments/${animeId}${epParam}`);
  return res.data;
};

export const createComment = async (data) => {
  // data: { animeId, episodeNum, text, parentId, userName, profileImage }
  const res = await API.post("/api/comments/create", data);
  return res.data;
};

export const likeComment = async (commentId) => {
  const res = await API.post(`/api/comments/${commentId}/like`);
  return res.data;
};

export const deleteComment = async (commentId) => {
  const res = await API.delete(`/api/comments/${commentId}`);
  return res.data;
};

export default {
  getComments,
  createComment,
  likeComment,
  deleteComment,
};
